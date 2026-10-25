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
		const response = await fetch(fullUrl, {
		method: 'GET',
		headers: { 'Range': 'bytes=0-0' },
		signal: controller.signal
	});
	clearTimeout(timeoutId);
	return response.ok || response.status === 206;
} catch (error)
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
	async load()
	{
		const response = await fetch(this.url);
		const arrayBuffer = await response.arrayBuffer();
		let tempBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
		if (this.makeMono)
		this.buffer = await this.optimizeAudioBuffer(tempBuffer);
		else
		this.buffer = tempBuffer;
		tempBuffer = null;
	}
	async optimizeAudioBuffer(originalBuffer, forceMono=true)
	{
		if (originalBuffer.numberOfChannels !== 2) return originalBuffer;
		const left = originalBuffer.getChannelData(0);
		const right = originalBuffer.getChannelData(1);
		const len = originalBuffer.length;
		if (!forceMono)
		{
			const stride = Math.floor(len / 100) || 1;
			let isStereo = false;
			for (let i = 0; i < len; i += stride)
			{
				if (Math.abs(left[i] - right[i]) > 1e-6) { isStereo = true; break; }
			}
			if (!isStereo)
			{
				for (let i = 0; i < len; i++)
				{
					if (Math.abs(left[i] - right[i]) > 1e-6) { isStereo = true; break; }
				}
			}
			if (isStereo) return originalBuffer;
		}
		const monoBuffer = this.audioContext.createBuffer(1, len, originalBuffer.sampleRate);
		const monoData =monoBuffer.getChannelData(0);
		monoData.set(left);
		originalBuffer.getChannelData(0).set([]);
		originalBuffer.getChannelData(1).set([]);
		return monoBuffer;
	}
	setupNode(playbackRate, tim)
	{
		if (!this.buffer) throw new Error("Audio buffer not loaded yet.");
		this.sourceNode = this.audioContext.createBufferSource();
		this.sourceNode.buffer = this.buffer;
		this.trackGain.gain.value = this.volume;
		if (this.#is3D)
		this.panner.positionX.value=this.panner.positionX.value;
		else
		this.panner.pan.value = this.pan;
		this.sourceNode.connect(this.trackGain);
		this.trackGain.connect(this.panner);
		this.sourceNode.playbackRate.setValueAtTime(playbackRate, tim);
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
			mixer.raiseEvent("lrPanChanged", this, value);
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
			mixer.raiseEvent("lrPanChanged", this, value);
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
			mixer.raiseEvent("fbPanChanged", this, value);
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
		mixer.raiseEvent("volumeChanged", this, volume);
	}
	get volume()
	{
		return this.trackGain.gain.value;
	}
	get duration()
	{
		return this.buffer.duration;
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
	}
	async loadImpulse()
	{
		try
		{
			let p = "https:@/mdn.github.io/voice-change-o-matic/audio/concert-crowd.ogg";
			p = p.replace('@', '/');
			const response = await fetch(p);
			const arrayBuffer = await response.arrayBuffer();
			const decodedAudio = await audioContext.decodeAudioData(arrayBuffer);
			convolver.buffer = decodedAudio;
		}
		catch (error)
		{
			console.error("Unable to fetch the audio file: ${name} Error: ${err.message}");
		}
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
	async loadTracks()
	{
		await Promise.all(this.tracks.map(track => track.load()));
		this.#mDuration = Math.min(...this.tracks.map(t => t.buffer.duration));
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
		this.tracks.forEach((track, index) =>
		{
			track.setupNode(this.#mPlaybackRate, launchTime);
			track.sourceNode.start(launchTime, this.positionAtPause);
			if (index === 0)
			{
				track.sourceNode.onended = () =>
				{
					const current = this.getCurrentPosition();
					if (this.isPlaying && current >= this.#mDuration - 0.1)
					{
						this.isPlaying = false;
						this.positionAtPause = 0;
						this.dispatchEvent(new Event('ended'));
					}
				};
			}
		});
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
			if (track.sourceNode)
			{
				track.sourceNode.onended = null;
				track.sourceNode.stop();
				track.sourceNode = null;
			}
		});
		this.isPlaying = false;
		this.dispatchEvent(new Event('pause'));
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
	get bass() { return this.bassFilter ? this.bassFilter.gain.value : 0; }
	set bass(value)
	{
		if (this.bassFilter && this.audioContext)
		{
			this.bassFilter.gain.setValueAtTime(value, this.audioContext.currentTime);
		}
	}
	get treble() { return this.trebleFilter ? this.trebleFilter.gain.value : 0; }
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
		const lagCompensation = this.audioContext.outputLatency || 0;
		return Math.max(0, currentPosition - (lagCompensation * this.#mPlaybackRate));
	}
	set currentPosition(value) { this.setCurrentPosition(value); }
	get currentPosition() { return this.getCurrentPosition(); }
	setCurrentPosition(seconds)
	{
		if (seconds < 0) seconds = 0;
		else if (seconds > this.#mDuration) seconds = this.#mDuration;
		const lookAhead = 0.05;
		const launchTime = this.audioContext.currentTime + lookAhead;
		if (this.isPlaying)
		{
			this.tracks.forEach(track =>
			{
				if (track.sourceNode)
				{
					track.sourceNode.onended = null;
					track.sourceNode.stop();
					track.sourceNode = null;
					track.setupNode(this.#mPlaybackRate, launchTime);
				}
			});
			this.positionAtPause = seconds;
			this.tracks.forEach((track, index) =>
			{
				track.sourceNode.start(launchTime, this.positionAtPause);
				if (index === 0)
				{
					track.sourceNode.onended = () =>
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
			this.startTime = launchTime;
		}
		else
		{
			this.positionAtPause = seconds;
		}
	}
	get duration()
	{
		return this.#mDuration;
	}
	get playbackRate()
	{
		return this.#mPlaybackRate;
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
			if (track.sourceNode && track.sourceNode.playbackRate)
			{
				track.sourceNode.playbackRate.setValueAtTime(targetRate, now);
			}
		});
		this.dispatchEvent(new Event('ratechange'));
	}
}
