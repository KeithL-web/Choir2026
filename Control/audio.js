class Item
{
	constructor(name, audioUrl, pan, makeMono)
	{
		this.name = name;
		this.audioUrl = audioUrl;
		this.pan = pan;
		this.makeMono = makeMono;
	}
}
async function checkFileExists(url, timeoutMs = 2000)
{
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	try
	{
		const fullUrl = new URL(url, window.location.href).href;
		const response = await fetch(fullUrl,
		{
			method: 'GET',
			headers: { 'Range': 'bytes=0-0' },
			signal: controller.signal
		});
		clearTimeout(timeoutId);
		return response.ok || response.status === 206;
	}
	catch (error)
	{
		clearTimeout(timeoutId);
		if (error.name !== 'AbortError')
		{
			console.warn(`File check failed for ${url}:`, error.message);
		}
		return false;
	}
}
class AudioTrack
{
	#_name;
	#mixer;
	#is3D;
	#distScale;
	constructor(mixer, name, audioUrl,pan, makeMono)
	{
		this.#_name = name;
		this.#mixer = mixer;
		this.audioContext = mixer.audioContext;
		this.url = audioUrl;
		this.buffer = null;
		this.sourceNode = null;
		this.trackGain = this.audioContext.createGain();
		this.#is3D = mixer.use3d;
		this.#distScale = 3.5;
		if (this.#is3D)
		{
			this.panner = this.audioContext.createPanner();
			this.panner.distanceModel = 'inverse';
			this.panner.panningModel = 'HRTF';
			this.panner.refDistance = 2;
			this.panner.maxDistance = 10000;
			this.panner.rollOffFactor = .6;
			this.panner.positionX.value = pan * this.#distScale;
			this.panner.positionY.value = 0;
		}
		else
		{
			this.panner = this.audioContext.createStereoPanner();
			this.panner.pan.value = pan;
		}
		this.makeMono = false;
		this.trackGain.connect(this.panner);
		this.panner.connect(mixer.connectTo);
	}
	dispose()
	{
		this.audioElement.pause();
		this.audioElement.src = '';
		this.audioElement.removeAttribute('src');
		this.audioElement.load();
		this.trackGain.disconnect();
		this.panner.disconnect();
		this.trackGain = null;
		this.panner = null;
		this.audioContext = null;
	}
	async load()
	{
		return new Promise((resolve, reject) =>
		{
			const audio = new Audio(this.url);
			audio.crossOrigin = "anonymous";
			audio.preload = "auto";
			audio.preservesPitch = true;
			audio.addEventListener('canplaythrough', () =>
			{
				this.audioElement = audio;
				this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
				if (this.makeMono)
				{
					this.sourceNode.channelCount = 1;
					this.sourceNode.channelCountMode = "explicit";
					this.sourceNode.channelInterpretation = "speakers";
				}
				this.sourceNode.connect(this.trackGain);
				resolve();
			}, { once: true });
			audio.addEventListener('error', (err) => reject(err), { once: true });
		});
	}
	setupNode(playbackRate, tim)
	{
		if (!this.audioElement) throw new Error("Audio track not loaded yet.");
		this.trackGain.gain.value = this.volume;
		if (this.panner)
		{
			if (this.panner.positionX)
			{
				this.panner.positionX.value = this.panner.positionX.value;
			} else
			{
				this.panner.pan.value = this.pan;
			}
		}
		this.audioElement.playbackRate = playbackRate;
	}
	get duration()
	{
		return this.audioElement ? this.audioElement.duration : 0;
	}
	Trim(value, from, to)
	{
		if (value < from) value = from;
		else if (value > to) value = to;
		return value;
	}
	updateParameter(param, targetValue, rampTime = 0.03)
	{
		const now = this.audioContext.currentTime;
		if (this.#mixer.isPlaying)
		{
			param.setValueAtTime(param.value, now);
			param.linearRampToValueAtTime(targetValue, now + rampTime);
		}
		else
		{
			param.value = targetValue;
		}
	}
	set pan(value)
	{
		if (this.#is3D)
		{
			this.panLR = value;
		}
		else
		{
			value = this.Trim(value, -1, 1);
			this.updateParameter(this.panner.pan, value);
			this.#mixer.raiseEvent("lrPanChanged", this, value);
		}
	}
	get pan()
	{
		if (this.#is3D)
		return this.panner.positionX.value / this.#distScale;
		else
		return this.panner.pan.value;
	}
	set panLR(value)
	{
		if (this.#is3D)
		{
			value = this.Trim(value, -1, 1) * this.#distScale;
			this.updateParameter(this.panner.positionX, value);
			this.#mixer.raiseEvent("lrPanChanged", this, value);
		}
	}
	get panLR()
	{
		if (this.#is3D) return this.panner.positionX.value / this.#distScale;
		else return 0;
	}
	set panFB(value)
	{
		if (this.#is3D)
		{
			value = this.Trim(value, -1, 1);
			const z = 4.5 * value + 1.5;
			this.updateParameter(this.panner.positionZ, z);
			this.#mixer.raiseEvent("fbPanChanged", this, value);
		}
	}
	get panFB()
	{
		if (this.#is3D)
		{
			const z = this.panner.positionZ.value;
			return (z - 1.5) / 4.5;
		}
		else return 0;
	}
	set volume(volume)
	{
		volume = this.Trim(volume, 0, 1);
		this.updateParameter(this.trackGain.gain, volume);
		this.#mixer.raiseEvent("volumeChanged", this, volume);
	}
	get volume()
	{
		return this.trackGain.gain.value;
	}
	get duration()
	{
		return this.audioElement ? this.audioElement.duration : 0;
	}
	get name()
	{
		return this.#_name;
	}
	get index()
	{
		return this.#mixer.getIndex(this);
	}
}
class AudioMixer extends EventTarget
{
	#mDuration;
	#mPlaybackRate;
	constructor(use3dSound=false)
	{
		super();
		this.use3d = use3dSound;
		this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
		this.syncForClick=false;
		const SIMULATE_HIGH_LATENCY = false;
		if (SIMULATE_HIGH_LATENCY)
		{
			const fakeOutputLatency = 0.400;
			const fakeBaseLatency = 0.100;
			const totalPhysicalDelay = fakeOutputLatency + fakeBaseLatency;
			Object.defineProperty(this.audioContext, 'outputLatency', { get: () => fakeOutputLatency });
			Object.defineProperty(this.audioContext, 'baseLatency', { get: () => fakeBaseLatency });
			this.testingDelayNode = this.audioContext.createDelay(2.0);
			this.testingDelayNode.delayTime.setValueAtTime(totalPhysicalDelay, this.audioContext.currentTime);
			this.testingDelayNode.connect(this.audioContext.destination);
			Object.defineProperty(this.audioContext, 'destination', {
			get: () => this.testingDelayNode
		});
		console.log(`Physical Lag Engine Active! Audio is physically delayed by ${totalPhysicalDelay}s.`);
	}
	this.tracks = [];
	this.#mDuration = 0;
	this.isPlaying = false;
	this.startTime = 0;
	this.positionAtPause = 0;
	this.#mPlaybackRate = 1.0
	this.keepPlaying = true;
	this.bassFilter = this.audioContext.createBiquadFilter();
	this.bassFilter.type = "lowshelf";
	this.bassFilter.frequency.setValueAtTime(200, this.audioContext.currentTime);
	this.bassFilter.channelCount = 2;
	this.bassFilter.channelCountMode = 'explicit';
	this.trebleFilter = this.audioContext.createBiquadFilter();
	this.trebleFilter.type = "highshelf";
	this.trebleFilter.frequency.setValueAtTime(3000, this.audioContext.currentTime);
	this.trebleFilter.channelCount = 2;
	this.trebleFilter.channelCountMode = 'explicit';
	this.masterGain = this.audioContext.createGain();
	this.masterGain.channelCount = 2;
	this.masterGain.channelCountMode = 'explicit';
	this.connectTo = this.bassFilter;
	this.bassFilter.connect(this.trebleFilter);
	this.trebleFilter.connect(this.masterGain);
	this.masterGain.connect(this.audioContext.destination);
	this.disposed = false;
	this.doUnload = () => this.dispose();
	window.addEventListener('beforeunload', this.doUnload);
}
dispose()
{
	if (this.disposed) return;
	this.disposed = true;
	this.tracks.forEach(tr => tr.dispose());
	this.tracks = [];
	this.bassFilter.disconnect();
	this.bassFilter = null;
	this.trebleFilter.disconnect();
	this.trebleFilter = null;
	this.masterGain.disconnect();
	this.masterGain = null;
	this.connectTo = null;
	this.audioContext.close();
	this.audioContext = null;
	window.removeEventListener('beforeunload', this.doUnload);
}
raiseEvent(name, track, value)
{
	const myEvent = new CustomEvent(name,
	{
		detail:
		{
			track: track,
			value: value,
		},
		bubbles: false,
	});
	this.dispatchEvent(myEvent);
}
async loadTracks()
{
	await Promise.all(this.tracks.map(track => track.load()));
	this.#mDuration = Math.min(...this.tracks.map(t => t.duration));
	document.addEventListener('visibilitychange', async () =>
	{
		if (document.hidden)
		{
			if (this.keepPlaying) return;
			if (this.audioContext && this.audioContext.state !== 'closed')
			{
				await this.audioContext.suspend();
			}
		}
		else
		{
			if (this.audioContext && this.audioContext.state === 'suspended')
			{
				await this.audioContext.resume();
			}
		}
	});
}
play()
{
	if (this.isPlaying) return;
	if (this.audioContext.state === 'suspended') this.audioContext.resume();
	if (this.positionAtPause >= this.#mDuration)
	{
		this.positionAtPause = 0;
	}
	const lookAhead = 0.05;
	const launchTime = this.audioContext.currentTime + lookAhead;
	let dur = 9999999;
	let theIndex = -1;
	this.tracks.forEach((track, index) =>
	{
		track.setupNode(this.#mPlaybackRate, launchTime);
		track.audioElement.currentTime = this.positionAtPause;
		track.audioElement.play();
		if (track.duration < dur)
		{
			dur = track.duration;
			theIndex = index;
		}
	});
	if (theIndex >= 0)
	{
		this.tracks[theIndex].audioElement.onended = () =>
		{
			const current = this.getCurrentPosition();
			if (this.isPlaying && current >= this.#mDuration - 0.1)
			{
				this.stop();
				this.dispatchEvent(new Event('ended'));
			}
		};
	}
	this.startTime = launchTime;
	this.isPlaying = true;
	this.dispatchEvent(new Event('play'));
}
pause()
{
	if (!this.isPlaying) return;
	const elapsedRealTime = (this.audioContext.currentTime - this.startTime);
	const elapsedAudioTime = elapsedRealTime * this.#mPlaybackRate;
	this.positionAtPause += elapsedAudioTime;
	if (this.positionAtPause >= this.#mDuration)
	{
		this.positionAtPause = 0;
	}
	this.tracks.forEach(track =>
	{
		if (track.audioElement)
		{
			track.audioElement.onended = null;
			track.audioElement.pause();
		}
	});
	this.isPlaying = false;
	this.dispatchEvent(new Event('pause'));
}
set currentSyncedPosition(seconds)
{
	const oldValue = this.this.blnSyncForClick;
	this.blnSyncForClick = false;
	setCurrentPosition(seconds + this.totalLatency * this.#mPlaybackRate);
	this.blnSyncForClick = oldValue;
}
set syncForClick(value)
{
	if (typeof(value) ==='boolean')
	this.blnSyncForClick = value;
}
get syncForClick()
{
	return this.blnSyncForClick;
}
setCurrentPosition(positionSeconds)
{
	let positionToStart = positionSeconds;
	const lookAhead = 0.05;
	if (this.blnSyncForClick) positionToStart += this.totalLatency * this.#mPlaybackRate +lookAhead;
	if (positionToStart < 0) positionToStart = 0;
	else if (positionToStart > this.#mDuration) positionToStart = this.#mDuration;
	const whenToStart = this.audioContext.currentTime + lookAhead;
	if (this.isPlaying)
	{
		this.positionAtPause = positionToStart;
		this.tracks.forEach((track, index) =>
		{
			track.setupNode(this.#mPlaybackRate, whenToStart);
			track.audioElement.currentTime = this.positionAtPause;
			if (index === 0)
			{
				track.audioElement.onended = () =>
				{
					if (this.isPlaying && this.getCurrentPosition() >= this.#mDuration - 0.1)
					{
						this.isPlaying = false;
						this.positionAtPause = 0;
						this.dispatchEvent(new Event('ended'));
					}
				};
			}
		});
		this.startTime = whenToStart;
	}
	else
	{
		this.positionAtPause = positionToStart;
		this.tracks.forEach(track =>
		{
			if (track.audioElement) track.audioElement.currentTime = positionToStart;
		});
	}
}
get masterPitch()
{
	return this._masterPitchCents;
}
set masterPitch(cents)
{
	if (this.delayPhaser)
	{
		this._masterPitchCents = Math.max(-1200, Math.min(1200, cents));
		this.delayPhaser.setPitchOffset(this._masterPitchCents);
	}
}
set playbackRate(value)
{
	const targetRate = Math.max(0.1, Math.min(value, 4.0));
	const now = this.audioContext.currentTime;
	if (this.isPlaying)
	{
		const elapsedSinceLaunch = (now - this.startTime) * this.#mPlaybackRate;
		this.positionAtPause += elapsedSinceLaunch;
		this.startTime = now;
	}
	this.#mPlaybackRate = targetRate;
	this.tracks.forEach(track =>
	{
		if (track.audioElement)
		{
			track.audioElement.playbackRate = targetRate;
		}
	});
	this.dispatchEvent(new Event('ratechange'));
}
get count()
{
	return this.tracks.length;
}
addTrack(trackInstance)
{
	this.tracks.push(trackInstance);
}
getTrackByIndex(index)
{
	return this.tracks[index];
}
getTrackByName(name)
{
	for (let i = 0; i < this.tracks.length; i++)
	if (this.tracks[i].name === name) return this.tracks[i];
	return null;
}
getIndex(track)
{
	for (let i = 0; i < this.tracks.length; i++)
	if (this.tracks[i]===track) return i;
	return -1;
}
stop()
{
	this.pause();
	this.currentPosition = 0;
}
get paused()
{
	return (!this.isPlaying);
}
#vScale = 2.0;
get volume()
{
	return this.masterGain ? this.masterGain.gain.value / this.#vScale : 1.0;
}
set volume(value)
{
	const normalizedValue = this.#vScale * Math.max(0, Math.min(1, value));
	if (this.masterGain && this.audioContext)
	{
		this.masterGain.gain.setValueAtTime(normalizedValue, this.audioContext.currentTime);
		this.dispatchEvent(new Event('volumechange'));
	}
}
get bass()
{
	return this.bassFilter ? this.bassFilter.gain.value : 0;
}
set bass(value)
{
	if (this.bassFilter && this.audioContext)
	{
		this.bassFilter.gain.setValueAtTime(value, this.audioContext.currentTime);
	}
}
get treble()
{
	return this.trebleFilter ? this.trebleFilter.gain.value : 0;
}
set treble(value)
{
	if (this.trebleFilter && this.audioContext)
	{
		this.trebleFilter.gain.setValueAtTime(value, this.audioContext.currentTime);
	}
}
getCurrentPosition()
{
	if (!this.isPlaying) return this.positionAtPause;
	const rawElapsed = this.audioContext.currentTime - this.startTime;
	const scaledElapsed = rawElapsed * this.#mPlaybackRate;
	const currentPosition = this.positionAtPause + scaledElapsed;
	return Math.max(0, currentPosition - this.totalLatency * this.#mPlaybackRate);
}
get outputLatency()
{
	return this.audioContext.outputLatency || 0;
}
get totalLatency()
{
	return (this.audioContext.outputLatency || 0) + (this.audioContext.baseLatency || 0);
}
get baseLatency()
{
	return (this.audioContext.baseLatency || 0);
}
set currentPosition(value) { this.setCurrentPosition(value); }
get currentPosition() { return this.getCurrentPosition(); }
get duration()
{
	return this.#mDuration;
}
get playbackRate()
{
	return this.#mPlaybackRate;
}
}
