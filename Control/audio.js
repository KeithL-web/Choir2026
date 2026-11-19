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
	#name;
	#mixer;
	#is3D;
	#distScale;
	#audioContext;
	#url;
	#buffer;
	#sourceNode;
	#pitchShift;
	#trackGain;
	#panner;
	static pitchWindowSize = 0.2;
	static pitchDelayTime = 0;
	constructor(mixer, name, audioUrl, pan, makeMono)
	{
		this.#name = name;
		this.#mixer = mixer;
		this.#audioContext = mixer.audioContext;
		this.#url = audioUrl;
		this.#buffer = null;
		this.#sourceNode = null;
		this.#trackGain = this.#audioContext.createGain();
		this.#pitchShift = new Tone.PitchShift({
		pitch: 0,
		windowSize: AudioTrack.pitchWindowSize,
		delayTime: AudioTrack.pitchDelayTime,
		wet: 0
	});
	this.#is3D = mixer.use3d;
	this.#distScale = 3.5;
	if (this.#is3D)
	{
		this.#panner = this.#audioContext.createPanner();
		this.#panner.distanceModel = 'inverse';
		this.#panner.panningModel = 'HRTF';
		this.#panner.refDistance = 2;
		this.#panner.maxDistance = 10000;
		this.#panner.rollOffFactor = .6;
		this.#panner.positionX.value = pan * this.#distScale;
		this.#panner.positionY.value = 0;
	} else
	{
		this.#panner = this.#audioContext.createStereoPanner();
		this.#panner.pan.value = pan;
	}
	this.makeMono = makeMono || false;
	Tone.connect(this.#pitchShift, this.#trackGain);
	this.#trackGain.connect(this.#panner);
	this.#panner.connect(mixer.connectTo);
}
dispose()
{
	if (this.audioElement)
	{
		this.audioElement.pause();
		this.audioElement.src = '';
		this.audioElement.removeAttribute('src');
		this.audioElement.load();
	}
	if (this.#pitchShift)
	{
		this.#pitchShift.disconnect();
		this.#pitchShift.dispose();
		this.#pitchShift = null;
	}
	this.#trackGain.disconnect();
	this.#panner.disconnect();
	this.#trackGain = null;
	this.#panner = null;
	this.#audioContext = null;
}
async load()
{
	return new Promise((resolve, reject) =>
	{
		const audio = new Audio(this.#url);
		audio.crossOrigin = "anonymous";
		audio.preload = "auto";
		audio.preservesPitch = false;
		audio.addEventListener('canplaythrough', () =>
		{
			this.audioElement = audio;
			this.#sourceNode = this.#audioContext.createMediaElementSource(this.audioElement);
			if (this.makeMono)
			{
				this.#sourceNode.channelCount = 1;
				this.#sourceNode.channelCountMode = "explicit";
				this.#sourceNode.channelInterpretation = "speakers";
			}
			Tone.connect(this.#sourceNode, this.#pitchShift);
			resolve();
		}, { once: true });
		audio.addEventListener('error', (err) => reject(err), { once: true });
	});
}
set preservePitch(value)
{
	this.audioElement.preservesPitch = value;
}
set pitch(value)
{
	this.#pitchShift.pitch = value;
	this.#pitchShift.wet.value = Math.abs(value) < 0.01 ? 0 : 1;
}
get pitch()
{
	return this.#pitchShift.pitch;
}
setupNode(playbackRate, tim)
{
	if (!this.audioElement) throw new Error("Audio track not loaded yet.");
	this.#trackGain.gain.value = this.volume;
	if (this.#panner)
	{
		if (this.#panner.positionX)
		{
			this.#panner.positionX.value = this.#panner.positionX.value;
		} else
		{
			this.#panner.pan.value = this.pan;
		}
	}
	this.audioElement.playbackRate = playbackRate;
}
Trim(value, from, to)
{
	if (value < from) return from;
	else if (value > to) return to;
	return value;
}
updateParameter(param, targetValue, rampTime = 0.03)
{
	const now = this.#audioContext.currentTime;
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
		this.updateParameter(this.#panner.pan, value);
		this.#mixer.raiseEvent("lrPanChanged", this, value);
	}
}
get pan()
{
	if (this.#is3D)
	return this.#panner.positionX.value / this.#distScale;
	else
	return this.#panner.pan.value;
}
set panLR(value)
{
	if (this.#is3D)
	{
		value = this.Trim(value, -1, 1) * this.#distScale;
		this.updateParameter(this.#panner.positionX, value);
		this.#mixer.raiseEvent("lrPanChanged", this, value);
	}
}
get panLR()
{
	if (this.#is3D) return this.#panner.positionX.value / this.#distScale;
	else return 0;
}
set panFB(value)
{
	if (this.#is3D)
	{
		value = this.Trim(value, -1, 1);
		const z = 4.5 * value + 1.5;
		this.updateParameter(this.#panner.positionZ, z);
		this.#mixer.raiseEvent("fbPanChanged", this, value);
	}
}
get panFB()
{
	if (this.#is3D)
	{
		const z = this.#panner.positionZ.value;
		return (z - 1.5) / 4.5;
	}
	else return 0;
}
set volume(volume)
{
	volume = this.Trim(volume, 0, 1);
	this.updateParameter(this.#trackGain.gain, volume);
	this.#mixer.raiseEvent("volumeChanged", this, volume);
}
get volume()
{
	return this.#trackGain.gain.value;
}
get duration()
{
	return this.audioElement ? this.audioElement.duration : 0;
}
get name()
{
	return this.#name;
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
	#disposed;
	#mPitch;
	#doUnload;
	#isPlaying;
	#startTime;
	#positionAtPause;
	#keepPlaying;
	#use3d;
	#syncForClick;
	#bassFilter;
	#trebleFilter;
	#masterGain;
	#tracks;
	#blnAdjustPitchForRate=false;
	constructor(use3dSound=false)
	{
		super();
		this.#use3d = use3dSound;
		this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
		Tone.setContext(this.audioContext);
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
	this.#tracks = [];
	this.#mDuration = 0;
	this.#isPlaying = false;
	this.#syncForClick = false;
	this.#startTime = 0;
	this.#positionAtPause = 0;
	this.#mPlaybackRate = 1.0
	this.#keepPlaying = true;
	this.#bassFilter = this.audioContext.createBiquadFilter();
	this.#bassFilter.type = "lowshelf";
	this.#bassFilter.frequency.setValueAtTime(200, this.audioContext.currentTime);
	this.#bassFilter.channelCount = 2;
	this.#bassFilter.channelCountMode = 'explicit';
	this.#trebleFilter = this.audioContext.createBiquadFilter();
	this.#trebleFilter.type = "highshelf";
	this.#trebleFilter.frequency.setValueAtTime(3000, this.audioContext.currentTime);
	this.#trebleFilter.channelCount = 2;
	this.#trebleFilter.channelCountMode = 'explicit';
	this.#masterGain = this.audioContext.createGain();
	this.#masterGain.channelCount = 2;
	this.#masterGain.channelCountMode = 'explicit';
	this.#bassFilter.connect(this.#trebleFilter);
	this.#trebleFilter.connect(this.#masterGain);
	this.#masterGain.connect(this.audioContext.destination);
	this.connectTo = this.#bassFilter;
	this.#mPitch = 0;
	this.#disposed = false;
	this.#doUnload = () => this.dispose();
	window.addEventListener('beforeunload', this.#doUnload);
}
get PitchLag()
{
	if (this.#mPitch == 0) return 0;
	return + (AudioTrack.pitchWindowSize / 2) + AudioTrack.pitchDelayTime;
}
dispose()
{
	if (this.#disposed) return;
	this.#disposed = true;
	this.#tracks.forEach(tr => tr.dispose());
	this.#tracks = [];
	this.#bassFilter.disconnect();
	this.#bassFilter = null;
	this.#trebleFilter.disconnect();
	this.#trebleFilter = null;
	this.#masterGain.disconnect();
	this.#masterGain = null;
	this.connectTo = null;
	this.audioContext.close();
	this.audioContext = null;
	window.removeEventListener('beforeunload', this.#doUnload);
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
	await Promise.all(this.#tracks.map(track => track.load()));
	this.#mDuration = Math.min(...this.#tracks.map(t => t.duration));
	document.addEventListener('visibilitychange', async () =>
	{
		if (document.hidden)
		{
			if (this.#keepPlaying) return;
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
	if (this.#isPlaying) return;
	if (this.audioContext.state === 'suspended') this.audioContext.resume();
	if (this.#positionAtPause >= this.#mDuration)
	{
		this.#positionAtPause = 0;
	}
	const lookAhead = 0.05;
	const launchTime = this.audioContext.currentTime + lookAhead;
	let dur = 9999999;
	let theIndex = -1;
	this.#tracks.forEach((track, index) =>
	{
		track.setupNode(this.#mPlaybackRate, launchTime);
		track.audioElement.currentTime = this.#positionAtPause;
		track.audioElement.play();
		if (track.duration < dur)
		{
			dur = track.duration;
			theIndex = index;
		}
	});
	if (theIndex >= 0)
	{
		this.#tracks[theIndex].audioElement.onended = () =>
		{
			const current = this.currentPosition;
			if (this.#isPlaying && current >= this.#mDuration - 0.1)
			{
				this.stop();
				this.dispatchEvent(new Event('ended'));
			}
		};
	}
	this.#startTime = launchTime;
	this.#isPlaying = true;
	this.dispatchEvent(new Event('play'));
}
pause()
{
	if (!this.#isPlaying) return;
	const elapsedRealTime = (this.audioContext.currentTime - this.#startTime);
	const elapsedAudioTime = elapsedRealTime * this.#mPlaybackRate;
	this.#positionAtPause += elapsedAudioTime;
	if (this.#positionAtPause >= this.#mDuration)
	{
		this.#positionAtPause = 0;
	}
	this.#tracks.forEach(track =>
	{
		if (track.audioElement)
		{
			track.audioElement.onended = null;
			track.audioElement.pause();
		}
	});
	this.#isPlaying = false;
	this.dispatchEvent(new Event('pause'));
}
set currentSyncedPosition(seconds)
{
	const oldValue = this.this.blnSyncForClick;
	this.blnSyncForClick = false;
	currentPosition = seconds + this.totalLatency * this.#mPlaybackRate;
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
set currentPosition(positionSeconds)
{
	let positionToStart = positionSeconds;
	const lookAhead = 0.05;
	if (this.blnSyncForClick) positionToStart += this.totalLatency * this.#mPlaybackRate +lookAhead;
	if (positionToStart < 0) positionToStart = 0;
	else if (positionToStart > this.#mDuration) positionToStart = this.#mDuration;
	const whenToStart = this.audioContext.currentTime + lookAhead;
	if (this.#isPlaying)
	{
		this.#positionAtPause = positionToStart;
		this.#tracks.forEach((track, index) =>
		{
			track.setupNode(this.#mPlaybackRate, whenToStart);
			track.audioElement.currentTime = this.#positionAtPause;
			if (index === 0)
			{
				track.audioElement.onended = () =>
				{
					if (this.#isPlaying && this.currentPosition  >= this.#mDuration - 0.1)
					{
						this.#isPlaying = false;
						this.#positionAtPause = 0;
						this.dispatchEvent(new Event('ended'));
					}
				};
			}
		});
		this.#startTime = whenToStart;
	}
	else
	{
		this.#positionAtPause = positionToStart;
		this.#tracks.forEach(track =>
		{
			if (track.audioElement) track.audioElement.currentTime = positionToStart;
		});
	}
}
set playbackRate(value)
{
	const targetRate = Math.max(0.1, Math.min(value, 4.0));
	const now = this.audioContext.currentTime;
	if (this.#isPlaying)
	{
		const elapsedSinceLaunch = (now - this.#startTime) * this.#mPlaybackRate;
		this.#positionAtPause += elapsedSinceLaunch;
		this.#startTime = now;
	}
	this.#mPlaybackRate = targetRate;
	this.#tracks.forEach(track =>
	{
		if (track.audioElement)
		{
			track.audioElement.playbackRate = targetRate;
		}
	});
	this.#applyRateAdjustedPitch(this.#mPitch, targetRate );
	this.dispatchEvent(new Event('ratechange'));
}
set preservePitch(value)
{
	this.#blnAdjustPitchForRate = value;
	this.#applyRateAdjustedPitch(this.#mPitch, this.#mPlaybackRate);
}
#applyRateAdjustedPitch(pitch, rate)
{
	const rateSemitoneShift = this.#blnAdjustPitchForRate?12 * Math.log2(rate):0;
	const compensatingPitch = pitch - rateSemitoneShift;
	this.#tracks.forEach((track, index) =>
	{
		track.pitch = compensatingPitch;
	});
}
#trim(value, from, to)
{
	if (value < from) return from;
	else if (value > to) return to;
	return value;
}
get pitch()
{
	return this.#mPitch;
}
set pitch(semitones)
{
	if (this.#disposed) return;
	semitones = this.#trim(semitones, -24, 24);
	this.#mPitch = semitones;
	this.#applyRateAdjustedPitch(semitones, this.#mPlaybackRate);
}
get pitch()
{
	return this.#mPitch;
}
get count()
{
	return this.#tracks.length;
}
addTrack(trackInstance)
{
	this.#tracks.push(trackInstance);
}
getTrackByIndex(index)
{
	return this.#tracks[index];
}
getTrackByName(name)
{
	for (let i = 0; i < this.#tracks.length; i++)
	if (this.#tracks[i].name === name) return this.#tracks[i];
	return null;
}
getIndex(track)
{
	for (let i = 0; i < this.#tracks.length; i++)
	if (this.#tracks[i]===track) return i;
	return -1;
}
stop()
{
	this.pause();
	this.currentPosition = 0;
}
get paused()
{
	return (!this.#isPlaying);
}
#vScale = 2.0;
get volume()
{
	return this.#masterGain ? this.#masterGain.gain.value / this.#vScale : 1.0;
}
set volume(value)
{
	const normalizedValue = this.#vScale * this.#trim(value, 0, 1);
	if (this.#masterGain && this.audioContext)
	{
		this.#masterGain.gain.setValueAtTime(normalizedValue, this.audioContext.currentTime);
		this.dispatchEvent(new Event('volumechange'));
	}
}
get bass()
{
	return this.#bassFilter ? this.#bassFilter.gain.value : 0;
}
set bass(value)
{
	if (this.#bassFilter && this.audioContext)
	{
		this.#bassFilter.gain.setValueAtTime(value, this.audioContext.currentTime);
	}
}
get treble()
{
	return this.#trebleFilter ? this.#trebleFilter.gain.value : 0;
}
set treble(value)
{
	if (this.#trebleFilter && this.audioContext)
	{
		this.#trebleFilter.gain.setValueAtTime(value, this.audioContext.currentTime);
	}
}
get currentPosition()
{
	if (this.#disposed) return 0;
	if (!this.#isPlaying) return this.#positionAtPause;
	const rawElapsed = this.audioContext.currentTime - this.#startTime;
	const scaledElapsed = rawElapsed * this.#mPlaybackRate;
	const currentPosition = this.#positionAtPause + scaledElapsed;
	return Math.max(0, currentPosition - this.totalLatency * this.#mPlaybackRate);
}
get outputLatency()
{
	return this.audioContext.outputLatency || 0;
}
get totalLatency()
{
	return (this.audioContext.outputLatency || 0) + (this.audioContext.baseLatency || 0) + this.PitchLag;
}
get baseLatency()
{
	return (this.audioContext.baseLatency || 0);
}
get duration()
{
	return this.#mDuration;
}
get playbackRate()
{
	return this.#mPlaybackRate;
}
}
class MusicScale
{
	static #noteRegex = /^([a-gA-G])(##|bb|#|b|n|\u{266F}|\u{266D}|\u{266E}|x|\u{1D12A}|\u{1D12B})?(-?\d+)$/u;
	static #noteOffsets = Object.freeze({
	C: 0,
	D: 2,
	E: 4,
	F: 5,
	G: 7,
	A: 9,
	B: 11,
});
static #accidentalOffsets = Object.freeze({
'#': 1,
'\u{266F}': 1,   // â™¯
'b': -1,
'\u{266D}': -1,  // â™­
'\u{266E}': 0,   // â™®
'##': 2,
'x': 2,
'\u{1D12A}': 2,  // ð„ª
'bb': -2,
'\u{1D12B}': -2, // ð„«
});
static #sharpNames = Object.freeze(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);
static #flatNames = Object.freeze(['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']);
static midiNoteToNamedNote(midi, { useFlats = false } = {})
{
	if (!Number.isInteger(midi) || midi < 0 || midi > 127)
	{
		return null;
	}
	const octave = Math.floor(midi / 12) - 1;
	const pitchClass = midi % 12;
	const names = useFlats ? MusicScale.#flatNames : MusicScale.#sharpNames;
	return `${names[pitchClass]}${octave}`;
}
static #parseNote(note)
{
	const match = note.trim().match(MusicScale.#noteRegex);
	if (!match) return null;
	const [, letter, accidental = '', octaveStr] = match;
	return {
	letter: letter.toUpperCase(),
	accidental,
	octave: Number(octaveStr),
};
}
static #noteToMidi(note)
{
	if (note === 'r') return -1;
	const parsed = MusicScale.#parseNote(note);
	if (!parsed) return null;
	const base = MusicScale.#noteOffsets[parsed.letter];
	const shift = MusicScale.#accidentalOffsets[parsed.accidental] ?? 0;
	return (parsed.octave + 1) * 12 + base + shift;
}
static Note = class
{
	constructor(noteName, duration)
	{
		if (noteName === 'r')
		{
			this.freq = '0';
		}
		else
		{
			const midi = MusicScale.#noteToMidi(noteName);
			this.freq = MusicScale.#midiToFreq(midi);
		}
		this.duration = duration;
	}
}
static #audioMidiContext;
static #currentMelody;
static #customWave;
static #getRichWave(ctx)
{
	if (this.#customWave) return this.#customWave;
	const real = new Float32Array([0, 1.0, 0.25, 0.08]);
	const imag = new Float32Array(real.length);
	this.#customWave = ctx.createPeriodicWave(real, imag);
	return this.#customWave;
}
static
{
	MusicScale.#audioMidiContext = null;
	MusicScale.#currentMelody = null;
	const doUnload = () => this.#dispose();
	window.addEventListener('beforeunload', this.doUnload);
}
static #dispose()
{
	MusicScale.stopPlay();
	if (MusicScale.#audioMidiContext)
	{
		if (MusicScale.#audioMidiContext.state !== 'closed')
		{
			MusicScale.#audioMidiContext.close();
		}
		MusicScale.#audioMidiContext = null;
	}
}
static stopPlay()
{
	if (MusicScale.#currentMelody != null) MusicScale.#currentMelody.stop();
	MusicScale.#currentMelody = null;
}
static playNote(note, duration = 1)
{
	MusicScale.stopPlay();
	const nt = new MusicScale.Note(note, duration);
	MusicScale.#currentMelody = MusicScale.#playMelody([nt], duration);
}
static playNotes(notes)
{
	MusicScale.stopPlay();
	MusicScale.#currentMelody=MusicScale.#playMelody(notes);
}
static #midiToFreq(midiNote)
{
	return 440 * Math.pow(2, (midiNote - 69) / 12);
}
static #presets = {
pluck: { tail: 0.08, attack: 0.008, masterVol: 0.85 },
medium: { tail: 0.35, attack: 0.012, masterVol: 0.70 },
harp: { tail: 1.20, attack: 0.015, masterVol: 0.55 }
};
static #playMelody(notes, sustain = 'harp')
{
	if (MusicScale.#audioMidiContext === null) MusicScale.#audioMidiContext = new AudioContext();
	if (MusicScale.#audioMidiContext.state === 'suspended') MusicScale.#audioMidiContext.resume();
	const cfg = typeof sustain === 'number'
	? { tail: sustain, attack: 0.012, masterVol: sustain > 0.6 ? 0.55 : 0.75 }
	: (this.#presets[sustain] ?? this.#presets.medium);
	const ctx = this.#audioMidiContext;
	const activeVoices = new Set();
	let isStopped = false;
	const masterGain = ctx.createGain();
	masterGain.gain.value = cfg.masterVol;
	masterGain.connect(ctx.destination);
	let noteIndex = 0;
	let nextNoteTime = ctx.currentTime + 0.05;
	const scheduleAheadTime = 0.25;
	const lookaheadInterval = 50;
	const scheduleVoice = (note, noteStart) =>
	{
		const noteEnd = noteStart + note.duration +  cfg.tail;
		const osc = ctx.createOscillator();
		osc.setPeriodicWave(this.#getRichWave(ctx));
		osc.frequency.setValueAtTime(note.freq * 1.004, noteStart);
		osc.frequency.exponentialRampToValueAtTime(note.freq, noteStart + 0.02);
		const filter = ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.setValueAtTime(note.freq * 6, noteStart);
		filter.frequency.exponentialRampToValueAtTime(Math.max(note.freq * 2, 400), noteEnd);
		const voiceGain = ctx.createGain();
		voiceGain.gain.setValueAtTime(0.0001, noteStart);
		voiceGain.gain.exponentialRampToValueAtTime(0.25, noteStart + cfg.attack);
		voiceGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
		osc.connect(filter);
		filter.connect(voiceGain);
		voiceGain.connect(masterGain);
		osc.start(noteStart);
		osc.stop(noteEnd + 0.02);
		const voice = { osc, filter, voiceGain };
		activeVoices.add(voice);
		osc.onended = () =>
		{
			osc.disconnect();
			filter.disconnect();
			voiceGain.disconnect();
			activeVoices.delete(voice);
			if (noteIndex >= notes.length && activeVoices.size === 0 && !isStopped)
			{
				masterGain.disconnect();
			}
		};
	};
	const schedulerId = setInterval(() =>
	{
		if (isStopped) return;
		while (noteIndex < notes.length && nextNoteTime < ctx.currentTime + scheduleAheadTime)
		{
			const note = notes[noteIndex];
			if (note.freq > 0)
			scheduleVoice(note, nextNoteTime);
			nextNoteTime += note.duration;
			noteIndex++;
		}
		if (noteIndex >= notes.length)
		{
			clearInterval(schedulerId);
		}
	}, lookaheadInterval);
	return {
	stop: () =>
	{
		if (isStopped) return;
		isStopped = true;
		clearInterval(schedulerId);
		const stopNow = ctx.currentTime;
		const fadeOut = 0.03;
		masterGain.gain.cancelScheduledValues(stopNow);
		masterGain.gain.setValueAtTime(Math.max(masterGain.gain.value, 0.0001), stopNow);
		masterGain.gain.exponentialRampToValueAtTime(0.0001, stopNow + fadeOut);
		activeVoices.forEach(v =>
		{
			try { v.osc.stop(stopNow + fadeOut + 0.01); }
			catch (_) {  }
		});
		setTimeout(() => masterGain.disconnect(), (fadeOut + 0.05) * 1000);
	}
};
}
static #playMelodyOLd(notes)
{
	if (MusicScale.#audioMidiContext === null) MusicScale.#audioMidiContext = new AudioContext();
	if (MusicScale.#audioMidiContext.state === 'suspended') MusicScale.#audioMidiContext.resume();
	const ctx = this.#audioMidiContext;
	const osc = ctx.createOscillator();
	const gainNode = ctx.createGain();
	osc.type = 'sine';
	osc.connect(gainNode);
	gainNode.connect(ctx.destination);
	let currentTime = ctx.currentTime;
	const fadeTime = 0.015;
	const gap = 0.03;
	gainNode.gain.setValueAtTime(0.0001, currentTime);
	notes.forEach(note =>
	{
		const noteStart = currentTime;
		const noteEnd = currentTime + note.duration;
		const soundOff = Math.max(noteStart + fadeTime * 2, noteEnd - gap);
		osc.frequency.setValueAtTime(note.freq, noteStart);
		gainNode.gain.setValueAtTime(0.0001, noteStart);
		gainNode.gain.exponentialRampToValueAtTime(0.2, noteStart + fadeTime);
		gainNode.gain.setValueAtTime(0.2, soundOff - fadeTime);
		gainNode.gain.exponentialRampToValueAtTime(0.0001, soundOff);
		currentTime = noteEnd;
	});
	osc.start(ctx.currentTime);
	osc.stop(currentTime);
	let isStopped = false;
	osc.onended = () =>
	{
		isStopped = true;
		osc.disconnect();
		gainNode.disconnect();
	};
	return {
	stop: () =>
	{
		if (isStopped) return;
		isStopped = true;
		const stopNow = ctx.currentTime;
		gainNode.gain.cancelScheduledValues(stopNow);
		gainNode.gain.setValueAtTime(Math.max(gainNode.gain.value, 0.0001), stopNow);
		gainNode.gain.exponentialRampToValueAtTime(0.0001, stopNow + fadeTime);
		osc.stop(stopNow + fadeTime);
	}
};
}
}
