class Jungle
{
	constructor(context)
	{
		this.context = context;
		this.input = context.createGain();
		this.output = context.createGain();
		this.tuneDelayTime = 0.100;
		const frameTime = this.tuneDelayTime;
		const fadeTime = this.tuneDelayTime;
		const bufferTime = frameTime + fadeTime;
		this.fadeBuffer = this._createFadeBuffer(context, frameTime, fadeTime);
		this.delayTimeBufferUp = this._createDelayTimeBuffer(context, frameTime, fadeTime, true);
		this.delayTimeBufferDown = this._createDelayTimeBuffer(context, frameTime, fadeTime, false);
		this.mod1 = context.createBufferSource();
		this.mod2 = context.createBufferSource();
		this.mod3 = context.createBufferSource();
		this.mod4 = context.createBufferSource();
		this.mod1Duration = bufferTime;
		this.mod2Duration = bufferTime;
		this.mod3Duration = bufferTime;
		this.mod4Duration = bufferTime;
		this.mod1Gain = context.createGain();
		this.mod2Gain = context.createGain();
		this.mod3Gain = context.createGain();
		this.mod4Gain = context.createGain();
		this.mod1Gain.gain.setValueAtTime(0, context.currentTime);
		this.mod2Gain.gain.setValueAtTime(0, context.currentTime);
		this.mod3Gain.gain.setValueAtTime(0, context.currentTime);
		this.mod4Gain.gain.setValueAtTime(0, context.currentTime);
		this.mod1.buffer = this.delayTimeBufferUp;
		this.mod2.buffer = this.delayTimeBufferDown;
		this.mod3.buffer = this.delayTimeBufferUp;
		this.mod4.buffer = this.delayTimeBufferDown;
		this.mod1.loop = true;
		this.mod2.loop = true;
		this.mod3.loop = true;
		this.mod4.loop = true;
		this.mod1Gain2 = context.createGain();
		this.mod2Gain2 = context.createGain();
		this.mod3Gain2 = context.createGain();
		this.mod4Gain2 = context.createGain();
		this.mod1Gain2.gain.value = 0;
		this.mod2Gain2.gain.value = 0;
		this.mod3Gain2.gain.value = 0;
		this.mod4Gain2.gain.value = 0;
		this.mod1.connect(this.mod1Gain2);
		this.mod2.connect(this.mod2Gain2);
		this.mod3.connect(this.mod3Gain2);
		this.mod4.connect(this.mod4Gain2);
		this.mod1Gain2.connect(this.mod1Gain.gain);
		this.mod2Gain2.connect(this.mod2Gain.gain);
		this.mod3Gain2.connect(this.mod3Gain.gain);
		this.mod4Gain2.connect(this.mod4Gain.gain);
		this.fade1 = context.createBufferSource();
		this.fade2 = context.createBufferSource();
		this.fade1.buffer = this.fadeBuffer;
		this.fade2.buffer = this.fadeBuffer;
		this.fade1.loop = true;
		this.fade2.loop = true;
		this.mix1 = context.createGain();
		this.mix2 = context.createGain();
		this.mix1.gain.value = 0;
		this.mix2.gain.value = 0;
		this.fade1.connect(this.mix1.gain);
		this.fade2.connect(this.mix2.gain);
		this.delay1 = context.createDelay();
		this.delay2 = context.createDelay();
		this.delay1.delayTime.value = 0;
		this.delay2.delayTime.value = 0;
		this.input.connect(this.delay1);
		this.input.connect(this.delay2);
		this.mod1Gain.connect(this.delay1.delayTime);
		this.mod2Gain.connect(this.delay1.delayTime);
		this.mod3Gain.connect(this.delay2.delayTime);
		this.mod4Gain.connect(this.delay2.delayTime);
		this.delay1.connect(this.mix1);
		this.delay2.connect(this.mix2);
		this.mix1.connect(this.output);
		this.mix2.connect(this.output);
		const t = context.currentTime + 0.050;
		const t2 = t + frameTime;
		this.mod1.start(t);
		this.mod2.start(t);
		this.mod3.start(t2);
		this.mod4.start(t2);
		this.fade1.start(t);
		this.fade2.start(t2);
		this.setPitchOffset(0.0);
	}
	setPitchOffset(mult)
	{
		if (mult > 0)
		{
			this.mod1Gain2.gain.value = 0;
			this.mod2Gain2.gain.value = mult * this.tuneDelayTime;
			this.mod3Gain2.gain.value = 0;
			this.mod4Gain2.gain.value = mult * this.tuneDelayTime;
		} else
		{
			this.mod1Gain2.gain.value = -mult * this.tuneDelayTime;
			this.mod2Gain2.gain.value = 0;
			this.mod3Gain2.gain.value = -mult * this.tuneDelayTime;
			this.mod4Gain2.gain.value = 0;
		}
	}
	_createFadeBuffer(context, activeTime, fadeTime)
	{
		const length1 = activeTime * context.sampleRate;
		const length2 = fadeTime * context.sampleRate;
		const length = length1 + length2;
		const buffer = context.createBuffer(1, length, context.sampleRate);
		const p = buffer.getChannelData(0);
		const fadeBegin = length1;
		const fadeEnd = length;
		for (let i = 0; i < length; ++i)
		{
			if (i < fadeBegin)
			{
				p[i] = 1.0;
			} else
			{
				p[i] = 1.0 - (i - fadeBegin) / (fadeEnd - fadeBegin);
			}
		}
		return buffer;
	}
	_createDelayTimeBuffer(context, activeTime, fadeTime, shiftUp)
	{
		const length1 = activeTime * context.sampleRate;
		const length2 = fadeTime * context.sampleRate;
		const length = length1 + length2;
		const buffer = context.createBuffer(1, length, context.sampleRate);
		const p = buffer.getChannelData(0);
		for (let i = 0; i < length; ++i)
		{
			if (shiftUp)
			{
				p[i] = (length - i) / length;
			} else
			{
				p[i] = i / length;
			}
		}
		return buffer;
	}
}
