'use strict';
let mixer, positionData, topBar, unhideDiv, btnPlay, btnStop, btnHide;
let radioPlayOnClick;
let barTable, controlWidth, controlHeight;
let btnInc, btnDec, btnNorm;
let numerator, denominator;
let dataType;
let rangePos, elePosition;
let rangeWidth;
let cellBeatNo, cellBarNo;
let maxBar = 0, maxBeatsPerBar = 0;
let barThickness = 84;
let blnBarVisible = true;
let blnPositioning = false;
let currentRow = null;
let theBegining = 0;
let blnStopped = true;
let blnCancelScroll = false;
let container, scoreSrc;
let scoreSourceAddress = null;
let resizerSize = 10;
let isTouchDeviceOrNoScores = false;
let blnLockPlay = false;
let blnPlayButtonsLocked = false;
let blnReady = false;
let currentNote = null;
const va0 = -11.09375;
const vaSkip = -10.46875 - va0;
function saveValue(name, value)
{
	if (!blnReady) return;
	localStorage.setItem(name, JSON.stringify(value));
}
function buildName(...parts)
{
	return parts.join(' ');
}
function getValue(name, defaultValue)
{
	const value = localStorage.getItem(name);
	if (value) return JSON.parse(value);
	else return defaultValue;
}
function removeValue(name)
{
	localStorage.removeItem(name);
}
function SetPlayButtonLock()
{
	if (document.getElementById('lock').checked === true)
	LockPlayButtons();
	else UnlockPlayButtons();
}
function SetKeepPlaying()
{
	mixer.keepPlaying = document.getElementById('kp').checked;
}
function LockPlayButtons()
{
	blnPlayButtonsLocked = true;
	mixer.pause();
	btnPlay.style.color = 'lightgrey';
	btnStop.style.color = 'lightgrey';
	document.getElementById('lock').checked = true;
}
function UnlockPlayButtons()
{
	blnPlayButtonsLocked = false;
	btnPlay.style.color = 'white';
	btnStop.style.color = 'white';
	checkLockPlay.checked = false;
	document.getElementById('lock').checked = false;
}
function LockPlayOnRowClick()
{
	blnLockPlay = true;
	if (playHow=== 'highlight')
	{
		StopMonitor();
		mixer.pause();
	}
}
function UnlockPlayOnRowClick()
{
	blnLockPlay = false;
}
function UnhighlightRow()
{
	HighlightRow(null);
}
const backColor = "transparent";
function HighlightRow(row)
{
	if (row == currentRow) return;
	if (currentRow != null) currentRow.style.backgroundColor = backColor;
	currentRow = row;
	if (currentRow != null) currentRow.style.backgroundColor = "yellow";
}
function OnPause()
{
	if (blnStopped) return;
	UpdateStatus();
}
function OnResumeOrPlay()
{
	blnStopped = false;
	UpdateStatus();
}
function OnPlayEnd()
{
	StopMonitor();
	mixer.stop();
}
function SetPosLabel(value = null)
{
	if (value != null)
	{
		value = Math.floor(value);
		if (!blnPositioning) rangePos.value = value;
	}
	else value = rangePos.value;
	elePosition.innerText = value + "/" + rangePos.max;
}
let fontSize = 100;
function FixButton(button, disable)
{
	button.disabled = disable;
	button.style.backgroundColor = disable ? "gray" : "#202020";
}
function SetFontEnables()
{
	FixButton(btnInc, fontSize >= 200);
	FixButton(btnDec, fontSize <=70);
	FixButton(btnNorm, fontSize > 95 && fontSize < 105)
	document.getElementById("lyrics").style.fontSize = fontSize + '%';
	btnNorm.innerHTML = 5 * Math.round(fontSize / 5) + "<sup>%</sup>";
	CheckFontSizes();
}
function DoDec()
{
	fontSize *= 0.9;
	SetFontEnables();
}
function DoInc()
{
	fontSize /= 0.9;
	SetFontEnables();
}
function DoNorm()
{
	fontSize = 100;
	SetFontEnables();
}
function DoPlay()
{
	blnStopped = false;
	if (mixer.paused)
	{
		if (mixer.currentPosition < theBegining) mixer.currentPosition = theBegining;
		if (!blnPlayButtonsLocked) mixer.play();
		MonitorRow();
		radioPlayOnClick.checked = true;
	}
	else
	{
		CancelScroll();
		mixer.pause();
		StopMonitor();
	}
}
function DoStop()
{
	if (blnStopped) return;
	CancelScroll();
	blnStopped = true;
	mixer.stop();
	mixer.currentPosition = theBegining;
	window.scrollTo(0, 0);
	UnhighlightRow(currentRow);
	StopMonitor();
	UpdateStatus();
	if ((dataType & 2) != 0)
	{
		cellBeatNo.innerText ='1';
		cellBarNo.innerText = positionData[0].Bar;
	}
}
function CancelScroll()
{
	blnCancelScroll = true;
}
function PxToVh(pixels)
{
	return (pixels / window.innerHeight) * 100;
}
function PxToHw(pixels)
{
	return (pixels / window.innerWidth) * 100;
}
function HideBar()
{
	topBar.style.display = 'none';
	unhideDiv.style.Order = 9999;
	blnBarVisible = false;
	btnHide.title = 'Unhide Controls';
	EnsureCorrectSizes();
}
function ToggleHide()
{
	if (blnBarVisible) HideBar();
	else UnhideBar();
}
function UnhideBar()
{
	topBar.style.display = 'block';
	unhideDiv.style.Order = 9999;
	blnBarVisible = true;
	btnHide.title = 'Hide Controls';
	FixTopBar();
	EnsureCorrectSizes();
}
function AutoTableClick(event)
{
	const td = event.currentTarget;
	const tr = td.parentElement;
	const row = tr.parentElement.closest('tr');
	if ('play' === playHow)
	{
		//	const row = tr.parentElement.closest('tr');
		let prop = 0 + td.getAttribute('o') / tr.getAttribute('tot');
		PlayRow(row, prop);
	}
	else if (playHow=='highlight')
	{
		MoveToRow(row);
	}
	event.stopPropagation();
}
function InnerHeight()
{
	let h = window.innerHeight-15;
	if (blnBarVisible) h -= barThickness;
	return h;
}
function InnerWidth()
{
	let w = window.innerWidth;
	return w;
}
let sizeRatio=0.5;
function MakeSureLyricPanelCorrectSize()
{
	if (blnLeftToRight)
	{
		let w = InnerWidth() - resizerSize;
		container.style.width = w + 'px';
		if (!isTouchDeviceOrNoScores)
		{
			w *= sizeRatio;
			w = Math.round(w);
		}
		lyricPanel.style.flexBasis = w + 'px';
		lyricPanel.style.width = w + 'px';
		if (!isTouchDeviceOrNoScores)
		{
			let nw = (container.offsetWidth - resizerSize - w) + 'px';
			scorePanel.style.flexBasis = nw;
			scorePanel.style.width = nw;
			scoreSrc.style.width = nw;
		}
	}
	else
	{
		let h = InnerHeight() - resizerSize;
		container.style.height = h + 'px';
		if (!isTouchDeviceOrNoScores)
		{
			h *= sizeRatio;
			h = Math.round(h);
		}
		lyricPanel.style.flexBasis = h + 'px';
		lyricPanel.style.height = h + 'px';
		if (!isTouchDeviceOrNoScores)
		{
			let nh = (container.offsetHeight - resizerSize - h) + 'px';
			scorePanel.style.flexBasis = nh;
			scorePanel.style.height = nh;
			scoreSrc.style.height = nh;
		}
	}
}
function EnsureCorrectSizes()
{
	let theWidth = InnerWidth() + 'px';
	let theHeight = InnerHeight() + 'px';
	container.style.width = theWidth;
	container.style.height = theHeight;
	container.style.marginTop = '0px';
	if (blnLeftToRight)
	{
		lyricPanel.style.height = theHeight;
		if (isTouchDeviceOrNoScores)
		{
			lyricPanel.style.width = (container.offsetWidth - resizerSize) + 'px';
		}
		else
		{
			scorePanel.style.height = theHeight;
			scoreSrc.style.height = theHeight;
			resizer.style.height = theHeight;
			resizer.style.width = resizerSize + 'px';
			let w = container.offsetWidth - lyricPanel.offsetWidth-resizerSize;
			scorePanel.style.flexBasis = w + 'px';
			scorePanel.style.width = w + 'px';
			scoreSrc.style.width = w + 'px';
		}
	}
	else
	{
		lyricPanel.style.width = theWidth;
		if (isTouchDeviceOrNoScores)
		{
			lyricPanel.style.height = (container.offsetHeight - resizerSize) + 'px';
		}
		else
		{
			resizer.style.width = theWidth;
			resizer.style.height = resizerSize + 'px';
			scorePanel.style.width = theWidth;
			scoreSrc.style.width = theWidth;
			let h = container.offsetHeight - lyricPanel.offsetHeight - resizerSize;
			scorePanel.style.flexBasis = h + 'px';
			scoreSrc.style.height = h + 'px';
		}
	}
}
const playIcon = '\u25B6';
const stopIcon = '\u23F9';
const pauseIcon = '\u23F8';
const resumeIcon = '\u23EF';
function UpdateStatus()
{
	let color = 'white';
	let disabled = false;
	if (blnStopped)
	{
		disabled = true;
		btnPlay.innerText = playIcon;
		color = 'gray';
	}
	else if (mixer.paused)
	{
		btnPlay.innerText = resumeIcon;
	}
	else
	{
		btnPlay.innerText = pauseIcon;
	}
	btnStop.style.color = color;
	btnStop.disabled = disabled;
}
let rowClickTime = 0;
function RowClick(event)
{
	if (playHow === 'highlight')
	{
		const row = event.srcElement.closest('tr');
		MoveToRow(row);
	}
	else if (playHow==='play')
	{
		let now = new Date().getTime();
		if (now - rowClickTime < 500) return;
		rowClickTime = now;
		PlayRow(event.srcElement.closest('tr'), 0);
	}
}
function PlayIndex(index)
{
	try
	{
		CancelScroll();
		mixer.currentPosition = positionData[index].Time;
		if (!blnPlayButtonsLocked) mixer.play();
		MonitorRow(index);
		return true;
	}
	catch
	{
		return false;
	}
}
function MoveToRow(row)
{
	UnhighlightRow();
	HighlightRow(row);
	try
	{
		let index = parseInt(row.id.substring(1));
		let beg = positionData[index].Time;
		mixer.currentPosition = beg;
	}
	catch
	{
	}
}
function PlayRow(row, propInto)
{
	if (blnPlayButtonsLocked) return;
	let index, beg;
	try
	{
		index = parseInt(row.id.substring(1));
		beg = positionData[index].Time;
	}
	catch
	{
		return;
	}
	CancelScroll();
	let offset = 0;
	if (propInto>0)
	{
		const end = positionData[index + 1].Time;
		offset = (end - beg) * propInto;
	}
	StopMonitor();
	mixer.currentPosition = beg + offset;
	mixer.play();
	MonitorRow(index);
}
let oldBeatSize, oldBeatsInBar;
let scrollDuration = 0;
function CheckForAutoScroll(instant, lowBarData)
{
	try
	{
		{
			let theBarBottom = blnBarVisible ? barThickness : 0;
			let rectRow = lowBarData.Row.getBoundingClientRect();
			let rowHeight = rectRow.bottom - rectRow.top;
			let theDiv = lyricPanel;
			let rc = theDiv.getBoundingClientRect();
			let theDivHeight = rc.bottom - rc.top;
			if (rectRow.bottom > rc.bottom - rowHeight || rectRow.top < theBarBottom)
			{
				let moveBy = rectRow.top - theBarBottom;
				let newScrollTop = moveBy + theDiv.scrollTop;
				if (instant || moveBy < 0)
				{
					const options = new Scroll(0, newScrollTop, 'instant');
					theDiv.scrollTo(options);
				}
				else
				{
					if (rectRow.top > rc.bottom )
					{
						const options = new Scroll(0, newScrollTop - theDivHeight, 'instant');
						theDiv.scrollTo(options);
					}
					blnCancelScroll = false;
					let scrollDuration = lowBarData.BeatsPerBar * lowBarData.MillisecondsPerBeat / mixer.playbackRate;
					SmoothScrollTo(theDiv, newScrollTop, scrollDuration * 0.5);
				}
			}
		}
	}
	catch
	{ }
	}
	let barData = null;
	let oldBarNo = -999999;
	let oldBeatNo = -1;
	function StopMonitor()
	{
		if (barData != null)
		{
			barData.ResetBackgrounds(backColor);
			barData = null;
		}
		oldBarNo = -999999;
		oldBeatNo = -1;
	}
	let posDiv = null;
	function getStack()
	{
		const err = new Error();
		console.log(err.stack);
	}
	let theID=0;
	function MonitorRow(index)
	{
		let instant = index === undefined;
		if (instant) index = findIndexForTime(mixer.currentPosition);
		if (positionData[index] === barData) return;
		StopMonitor();
		if (mixer.paused) return;
		try
		{
			barData = positionData[index];
			HighlightRow(barData.Row);
			numerator.innerText = barData.BeatsPerBar;
			denominator.innerText = barData.BeatSize;
		}
		catch
		{
			barData = null;
			return;
		}
		CheckForAutoScroll(instant, barData);
		let cellFirst, cellLast;
		let oldPos = 0;
		let rowInfos;
		if (barData.AutoTable)
		{
			if (posDiv === null)
			{
				posDiv = document.createElement('div');
				posDiv.id = 'posdiv';
				posDiv.style.position = "absolute";
				posDiv.style.width = '3px';
				posDiv.style.backgroundColor = 'darkred';
			}
			rowInfos = barData.RowInfos;
			let table = rowInfos[0].AutoRow.closest('table');
			table.style.position = 'relative';
			table.appendChild(posDiv);
			posDiv.style.top = 0;
			posDiv.style.height = table.offsetHeight + "px";
			let firstVisible = 0;
			for (let i = 0; i < rowInfos.length; i++)
			{
				if (rowInfos[i].AutoRow.style.display != 'none')
				{
					firstVisible = i;
					break;
				}
			}
			let rowInfo = rowInfos[firstVisible];
			let pointerFirst = rowInfo.AutoPointer[0];
			let pointerLast = rowInfo.AutoPointer[rowInfo.AutoPointer.length - 1];
			cellLast = rowInfo.AutoRow.cells[pointerLast];
			cellFirst = rowInfo.AutoRow.cells[pointerFirst];
			oldPos = (cellFirst.offsetLeft - 1);
			posDiv.style.left = (oldPos) + "px";
		}
		else if (posDiv != null)
		{
			posDiv.remove();
		}
		function CallBackAnimate(timeStamp)
		{
			if (barData === null) return;
			if (mixer.paused) return;
			const currentTime = mixer.currentPosition;
			let elapsed = (currentTime - barData.Time) / barData.Duration;
			if (index === 0 && elapsed < 0) elapsed = 0;
			if (elapsed < 0)
			{
				barData = null;
				console.log("Negative so recalc " + elapsed);
				setTimeout(MonitorRow, 1);
				return;
			}
			else if (elapsed > 1)
			{
				setTimeout(MonitorRow, 1, barData.Index + 1);
				return;
			}
			if (!blnPositioning)
			{
				if (dataType == 1) SetPosLabel(currentTime);
				else SetPosLabel(barData.Bar);
			}
			if ((dataType & 2) != 0)
			{
				let barNo = barData.Bar;
				let beatNo = barData.CurrentBeat(currentTime) - 1;
				if (beatNo >= barData.BeatsPerBar)
				{
					let extra = Math.floor(beatNo / barData.BeatsPerBar);
					barNo += extra;
					beatNo %= barData.BeatsPerBar;
				}
				{
					if (oldBeatNo != beatNo)
					{
						cellBeatNo.innerText = beatNo+1;
						oldBeatNo = beatNo;
					}
					if (oldBarNo != barNo)
					{
						cellBarNo.innerText = barNo;
						oldBarNo = barNo;
					}
				}
			}
			let showProgress=true;
			if (barData.AutoTable && showProgress)
			{
				let pos = cellFirst.offsetLeft + (cellLast.offsetLeft + cellLast.offsetWidth - cellFirst.offsetLeft) * elapsed - 1;
				oldPos = pos;
				posDiv.style.left = pos + "px";
				for (let r = 0; r < barData.RowInfos.length; r++)
				{
					let rowInfo = barData.RowInfos[r];
					let indexProp = Math.floor(elapsed * rowInfo.AutoTotal);
					if (indexProp >= rowInfo.AutoPointer.length) indexProp = rowInfo.AutoPointer.length - 1;
					if (indexProp != rowInfo.OldIndexProp)
					{
						let pointer = rowInfo.AutoPointer[indexProp];
						if (pointer != rowInfo.OldPointer)
						{
							try
							{
								rowInfo.AutoRow.cells[pointer].style.backgroundColor = rowInfo.BackColor;
							}
							catch
							{
								console.log("OH NO");
							};
							try
							{
								if (rowInfo.OldPointer >= 0)
								rowInfo.AutoRow.cells[rowInfo.OldPointer].style.backgroundColor = backColor;
							}
							catch { };
							rowInfo.OldPointer = pointer;
						}
						rowInfo.OldIndexProp = indexProp;
					}
				}
			}
			requestAnimationFrame(CallBackAnimate);
		}
		try
		{
			cancelAnimationFrame(theID);
		}
		catch
		{
		}
		theID = requestAnimationFrame(CallBackAnimate);
	}
	function SmoothScrollTo(container, targetY, duration)
	{
		const startY = container.scrollTop;
		const distance = targetY - startY;
		let startTime = null;
		const options = new Scroll(0, 0, 'instant');
		let atimeout;
		function AnimateScroll(currentTime)
		{
			if (blnCancelScroll) return;
			if (!startTime) startTime = currentTime;
			const progress = (currentTime - startTime) / duration;
			options.SetTop(startY + distance * progress);
			container.scrollTo(options);
			if (progress < 1)
			{
				clearTimeout(atimeout);
				atimeout = setTimeout(doNothing, 1);
				requestAnimationFrame(AnimateScroll);
			}
		}
		function doNothing()
		{
		}
		requestAnimationFrame(AnimateScroll);
	}
	class Scroll
	{
		constructor(left, top, behaviour = 'instant')
		{
			this.left = left;
			this.top = top;
			this.behavior = behaviour;
		}
		SetTop(t)
		{
			this.top = t;
		}
	}
	class Styler
	{
		constructor()
		{
		}
		BeginNew()
		{
			this.style = document.createElement('style');
		}
		Add(selector, styles)
		{
			if (this.style == null) this.BeginNew();
			this.style.appendChild(document.createTextNode(selector + ' {' + styles + '}'));
		}
		Finish()
		{
			document.head.appendChild(this.style);
			this.style = null;
		}
	}
	class RowInfo
	{
		constructor(row)
		{
			const td = row.getElementsByTagName('td');
			let offsets = new Array(td.length);
			let nOffsets = 0;
			let total = 0;
			let firstCellIndex = -1;
			for (let i = 0; i < td.length; i++)
			{
				let cell = td[i];
				if (cell.hasAttribute('o'))
				{
					if (firstCellIndex < 0) firstCellIndex = cell.cellIndex;
					offsets[nOffsets++] = parseInt(cell.getAttribute('o'));
				}
			}
			total = parseInt(row.getAttribute('tot'));
			let backColor = '#C0C0FF';
			let letter = row.getAttribute('pl');
			switch (letter)
			{
				case 'B':
				backColor = '#c0c0c0';
				break;
				case 'T':
				backColor = '#c0FFc0';
				break;
				case 'S':
				backColor = '#FFc0c0';
				break;
				case 'A':
				backColor = '#FFc0FF';
				break;
				case 'L':
				backColor = 'MistyRose';
				break;
				case 'M':
				backColor = 'LightBlue';
				break;
				default:
				letter = 'O';
				break;
			}
			this.BackColor = backColor;
			offsets.length = nOffsets;
			let align = 16;
			for (let i = 0; i < nOffsets; i++)
			{
				let al = offsets[i] & 15;
				if (al > 0)
				{
					al = al & 7;
					if (al === 4)
					{
						align = 4;
						break;
					}
					else align = 8;
				}
			}
			total /= align;
			total = Math.floor(total);
			for (let i = 0; i < nOffsets; i++)
			offsets[i] /= align;
			offsets[nOffsets] = total;
			let length = new Array(nOffsets);
			for (let i = 0; i < nOffsets; i++)
			length[i] = offsets[i + 1] - offsets[i];
			const pointer = new Array(total);
			let k = 0;
			for (let i = 0; i < nOffsets; i++)
			{
				for (let o = 0; o < length[i]; o++)
				pointer[k++] = i + firstCellIndex;
			}
			this.AutoPointer = pointer;
			this.AutoTotal = total;
			this.AutoRow = row;
			this.OldPointer = -1;
			this.OldIndexProp = -1;
		}
		Reset(color)
		{
			if (this.OldPointer >= 0)
			{
				this.AutoRow.cells[this.OldPointer].style.backgroundColor = color;
				this.OldPointer = -1;
			}
			this.OldIndexProp = -1;
		}
	}
	class BarData
	{
		constructor(index, time, bar, beatNo, beatsPerBar, millisecondsPerBeat, beatSize, row, isFX)
		{
			this.Index = index;
			this.Time = time;
			this.Bar = bar;
			this.BeatsPerBar = beatsPerBar;
			this.BeatSize = beatSize;
			this.BeatNo = beatNo;
			this.Row = row;
			this.MillisecondsPerBeat = millisecondsPerBeat;
			this.AutoTable = isFX;
			this.Duration = 0;
			if (isFX)
			{
				let table = row.getElementsByTagName('table');
				let isFX = false;
				for (let t = 0; t < table.length; t++)
				if (table[t].hasAttribute('fx'))
				{
					let rows = table[t].getElementsByTagName('tr');
					let rowInfos = new Array(rows.length);
					let nr = 0;
					for (let r = 0; r < rows.length; r++)
					{
						let aRow = rows[r];
						if (aRow.hasAttribute('tot'))
						{
							rowInfos[nr++] = new RowInfo(aRow);
						}
					}
					rowInfos.length = nr;
					this.RowInfos = rowInfos;
					this.NumberOfRowInfos = nr;
					break;
				}
			}
			return;
		}
		ResetBackgrounds(color)
		{
			for (let r = 0; r < this.NumberOfRowInfos; r++)
			this.RowInfos[r].Reset(color);
		}
		OffsetMillisecondsToBeat(n)
		{
			return (n - this.BeatNo) * this.MillisecondsPerBeat;
		}
		CurrentBeat(timeInSeconds)
		{
			let milliseconds = (timeInSeconds - this.Time) * 1000;
			return Math.floor(milliseconds / this.MillisecondsPerBeat) + this.BeatNo;
		}
		CurrentBar(timeInSeconds)
		{
			let b = this.CurrentBeat(timeInSeconds) - 1;
			return Math.floor(b / this.BeatsPerBar) + this.Bar;
		}
		NumberOfBeatsTo(bd)
		{
			let p1 = this.Bar * this.BeatsPerBar + this.BeatNo;
			let p2 = bd.Bar * this.BeatsPerBar + bd.BeatNo;
			return p2 - p1;
		}
	}
	function findIndexForBar(bar)
	{
		let leftIndex = 0;
		let rightIndex = positionData.length - 1;
		while (leftIndex <= rightIndex)
		{
			const mid = ~~Math.floor((leftIndex + rightIndex) * 0.5);
			if (bar >= positionData[mid].Bar)
			{
				const upper = mid < positionData.length - 1 ? positionData[mid + 1].Bar : 9999999999;
				if (bar < upper) return mid;
				else leftIndex = mid + 1;
			}
			else rightIndex = mid - 1;
		}
		return -1;
	}
	function findIndexForTime(time)
	{
		if (time < positionData[0].Time) return 0;
		let leftIndex = 0;
		let rightIndex = positionData.length - 1;
		while (leftIndex <= rightIndex)
		{
			const mid = ~~Math.floor((leftIndex + rightIndex) * 0.5);
			if (time >= positionData[mid].Time)
			{
				const upper = mid < positionData.length - 1 ? positionData[mid + 1].Time : 9999999999;
				if (time < upper) return mid;
				else leftIndex = mid + 1;
			}
			else rightIndex = mid - 1;
		}
		return -1;
	}
	function GetPos(range, ev)
	{
		const w = 4;
		let r = range.getBoundingClientRect();
		let x = ev.clientX - (r.left+w);
		let minValue = ~~range.min;
		if (x <= 0) return minValue;
		let width = r.right - r.left -2*w;
		let maxValue = ~~range.max;
		if (x >= width) return maxValue;
		return minValue + Math.floor((maxValue - minValue) * x / width);
	}
	function SetMediaPosition(ev)
	{
		CancelScroll();
		let value = GetPos(rangePos, ev);
		if (value == null) return;
		if (dataType == 1)
		{
			if (value < theBegining) value = theBegining;
			mixer.currentPosition = value;
		}
		else
		{
			let index = findIndexForBar(value);
			if (index >= 0) mixer.currentPosition = positionData[index].Time;
			cellBeatNo.innerText = '1';
			cellBarNo.innerText = positionData[index].Bar;
			if (mixer.paused)
			{
				HighlightRow(positionData[index].Row);
				positionData[index].Row.scrollIntoView({ behavior: 'smooth' });
			}
		}
	}
	let createdInner = null;
	function CreateInnerCell()
	{
		if (createdInner !== null) return createdInner;
		let span, xtd;
		let td = document.createElement('td');
		td.setAttribute('ot', '');
		let innerTable = document.createElement('table');
		innerTable.setAttribute('st', '');
		let aRow = innerTable.insertRow();
		xtd = aRow.insertCell();
		xtd.setAttribute('sc', '');
		xtd.id = "sig";
		span = document.createElement('span');
		span.setAttribute('lo', '');
		span.id = 'bpb';
		xtd.appendChild(span);
		xtd.appendChild(document.createElement('br'));
		span = document.createElement('span');
		span.setAttribute('hi', '');
		span.id = 'bs';
		xtd.appendChild(span);
		td.appendChild(innerTable);
		xtd = aRow.insertCell();
		xtd.setAttribute('dc', '1');
		span = document.createElement('span');
		span.id = 'timeSpan';
		span.setAttribute('lo', '');
		xtd.appendChild(span);
		xtd.appendChild(document.createElement('br'));
		span = document.createElement('span');
		span.id = 'dynSpan';
		span.setAttribute('hi', '');
		span.setAttribute('t', '');
		xtd.appendChild(span);
		td.appendChild(innerTable);
		createdInner = td;
		return td;
	}
	let mainTable;
	const dicVisible = { v1: false, v2: false };
	function SetVisibility(vWhat, val)
	{
		if (dicVisible[vWhat] === val) return;
		dicVisible[vWhat] = val;
		let temp = document.getElementsByTagName(vWhat);
		for (let i = 0; i < temp.length; i++)
		{
			temp[i].classList.toggle('hide', !val);
		}
	}
	function SetVHides()
	{
		let barVis = document.getElementById('barHide').checked;
		if (barVis)
		{
			SetVisibility('v1', false);
			SetVisibility('v2', false);
		}
		else
		{
			let partVis = document.getElementById('partHide').checked;
			if (partVis)
			{
				SetVisibility('v1', false);
				SetVisibility('v2', true);
			}
			else
			{
				SetVisibility('v1', true);
				SetVisibility('v2', false);
			}
		}
	}
	function ToggleSignatureColumn(event)
	{
		let val=!event.srcElement.checked;
		let temp = mainTable.rows;
		for (let i = 0; i < temp.length; i++)
		{
			if (temp[i].hasAttribute('t'))
			{
				temp[i].cells[0].classList.toggle('hide', val);
			}
		}
		SetVisibility('v1', val)
		CheckFontSizes();
	}
	function TogglePartColumn(event)
	{
		let table = mainTable.getElementsByTagName('table');
		let val = !event.srcElement.checked;
		for (let i = 0; i < table.length; i++)
		{
			if (table[i].hasAttribute('fx'))
			{
				//let rows = table[i].getElementsByTagName('tr');
				let rows = table[i].rows;
				for (let r = 0; r < rows.length; r++)
				if (r==0||rows[r].hasAttribute('tot')) rows[r].cells[0].classList.toggle('hide', val);
				else if (rows[r].hasAttribute('dr')) rows[r].cells[0].classList.toggle('hide',val);
			}
		}
		CheckFontSizes();
	}
	function FixTable()
	{
		mainTable = document.getElementById('lyrics');
		mainTable.style.userSelect = 'none';
		dataType = parseInt(mainTable.getAttribute('type'));
		let length = Math.floor(parseFloat(mainTable.getAttribute('length')));
		let temp = mainTable.getElementsByTagName('tr');
		let rows = new Array(temp.length);
		let nRows = 0;
		for (let i = 0; i < temp.length; i++)
		{
			if (temp[i].hasAttribute('t')) rows[nRows++] = temp[i];
		}
		positionData = new Array(nRows + 1);
		let oldBar = 0;
		let oldBeatsPerBar = 4;
		let oldBeatSize = 4;
		let oldBeatNo = 1;
		let oldColor = 'black';
		let oldDynamic = '';
		let oldMillisecondsPerBeat = 1;
		let bar;
		let beatNo;
		minPosValue = 99999999;
		maxPosValue = -99999999;
		positionData[0] = new BarData(0, 0, 0, 0, 0, 0, null,false);
		let infoCell = CreateInnerCell();
		infoCell.style.width='2em';
		let beatsPerBar, beatSize;
		for (let index = 0; index < nRows; index++)
		{
			let row = rows[index];
			let isBar = false;
			let changeSig = false;
			row.setAttribute('id', 'M' + index);
			let time = parseFloat(row.getAttribute('t'));
			if (time < 0) time = 0;
			let specialCell = null;
			let partsTable = null;
			if (row.hasAttribute('tx'))
			{
				isBar = false;
				positionData[index] = new BarData(index,time, 0, 0, 0, 0, 0, row,false);
			}
			else
			{
				isBar = true;
				oldBar++;
				bar = oldBar;
				beatsPerBar = oldBeatsPerBar;
				beatSize = oldBeatSize;
				let millisecondsPerBeat = oldMillisecondsPerBeat;
				beatNo = oldBeatNo;
				if (row.hasAttribute('b'))
				{
					bar = parseInt(row.getAttribute('b'));
					row.removeAttribute('b');
					oldBar = bar;
				}
				if (row.hasAttribute('bn'))
				{
					beatNo = parseInt(row.getAttribute('bn'));
					oldBeatNo = beatNo;
				}
				if (row.hasAttribute('bs'))
				{
					beatSize = parseInt(row.getAttribute('bs'));
					oldBeatSize = beatSize;
					if (oldBeatSize !== beatSize) changeSig = true;
				}
				if (row.hasAttribute('pb'))
				{
					beatsPerBar = parseInt(row.getAttribute('pb'));
					if (oldBeatsPerBar !== beatsPerBar) changeSig = true;
					oldBeatsPerBar = beatsPerBar;
					if (beatsPerBar > maxBeatsPerBar) maxBeatsPerBar = beatsPerBar;
				}
				if (row.hasAttribute('ms'))
				{
					millisecondsPerBeat = parseInt(row.getAttribute('ms'));
					oldMillisecondsPerBeat = millisecondsPerBeat;
				}
				let table = row.getElementsByTagName('table');
				let isFX = false;
				for (let t = 0; t < table.length; t++)
				if (table[t].hasAttribute('fx'))
				{
					isFX = true;
					let td = table[t].getElementsByTagName('td');
					let gotPart=false
					for (let itd = 0; itd < td.length; itd++)
					if (td[itd].hasAttribute('o'))
					{
						td[itd].addEventListener('click', AutoTableClick);
						if (specialCell==null)
						{
							specialCell = td[itd];
						}
					}
					break;
				}
				row.addEventListener("click", RowClick);
				positionData[index] = new BarData(index,time, bar, beatNo, beatsPerBar, millisecondsPerBeat, beatSize, row,isFX);
				if (bar < minPosValue) minPosValue = bar;
				if (bar > maxPosValue) maxPosValue = bar;
			}
			maxBar = oldBar;
			let color = oldColor;
			let dynamic = oldDynamic;
			if (row.hasAttribute('c'))
			{
				color = row.getAttribute('c');
				row.removeAttribute('c');
				oldColor = color;
			}
			row.style.color = color;
			row.style.backgroundColor = backColor;
			currentRow = row;
			let td = null;
			if (row.hasAttribute('d'))
			{
				dynamic = row.getAttribute('d');
				oldDynamic = dynamic;
			}
			if (dataType!=1)
			{
				td = infoCell.cloneNode(true);
				row.insertAdjacentElement('afterbegin', td);
				let span = td.querySelector('#timeSpan');
				if (isBar) span.innerText = bar + ":" + beatNo;
				else span.innerText = time;
				if (dynamic !== '')
				{
					td.querySelector('#dynSpan').innerText = dynamic;
				}
				if (isBar)
				{
					td.querySelector('#bpb').innerText = beatsPerBar;
					td.querySelector('#bs').innerText = beatSize;
					let sty = changeSig ? "ch" : "nc";
					td.querySelector("#sig").setAttribute(sty, '');
					if (specialCell != null)
					{
						specialCell.style.position = 'relative';
						let span = document.createElement('v1');
						span.className = 'hide';
						let txt = bar + ":" + beatNo;
						if (dynamic !== '') txt += "<br><span dyn>" + dynamic + "</span>";
						span.innerHTML = txt;
						specialCell.appendChild(span);
					}
				}
			}
		}
		positionData[nRows] = new BarData(nRows, length, maxPosValue + 1, 1, 0, 0, 0, null,false);
		theBegining = positionData[0].Time;
		if (dataType === 1)
		{
			minPosValue = Math.floor(theBegining);
			maxPosValue = Math.floor(length);
		}
		for (let i = 0; i < nRows; i++)
		{
			positionData[i].Duration = positionData[i+1].Time - positionData[i].Time;
		}
	}
	let minPosValue, maxPosValue;
	let lastSize = 0;
	function FontOrZoomChange(entries)
	{
		const curSize = entries[0].contentRect.width * window.devicePixelRatio;
		if (curSize !== lastSize)
		{
			lastSize = curSize;
			CheckFontSizes();
		}
	}
	async function Setup()
	{
		FixRows();
		let div = document.createElement('div');
		div.style = 'position:fixed;top:0;left:0;visibility:hidden;width:1rem;height:1rem;pointer-events:none;';
		document.body.prepend(div);
		lastSize = parseFloat(window.getComputedStyle(div).width);
		(new ResizeObserver(FontOrZoomChange)).observe(div);
		isTouchDeviceOrNoScores = 'ontouchstart' in document.documentElement;
		scoreSrc = document.getElementById("scoreSrc");
		//isTouchDeviceOrNoScores = true;
		if (scoreSrc == null)
		{
			isTouchDeviceOrNoScores = true;
			scoreSourceAddress = null;
		}
		else scoreSourceAddress = scoreSrc.src;
		if (isTouchDeviceOrNoScores)
		{
			resizerSize = 0;
			sizeRatio = 1;
			if (resizer != null)
			{
				scorePanel.remove();
				resizer.remove();
				resizer = null;
			}
		}
		container = document.getElementById('container');
		FixTable();
		topBar = document.getElementById('topbar');
		topBar.style.userSelect = 'none';
		topBar.style.fontSize = '18pt';
		let style = new Styler();
		style.Add(".button", "color:white;background-color:#202020;width:4em;height:auto;padding:0.6ex 0.2ex 0.6ex 0.2ex;border:1px solid white;cursor:pointer;");
		style.Add(".buttonPlay", "color:white;background-color:#000;width:2em;height:auto;padding:0.1ex;font-size:200%;border-style:none; cursor:pointer");
		style.Add(".buttonUnhide", "color:white;background-color:#400050;width:2em;height:2em;padding:0;border:1px solid white;cursor:pointer;position:fixed;top:0");
		style.Finish();
		unhideDiv = document.getElementById('unhide');
		btnHide = CreateButton('buttonUnhide', "...", "Unhide controls", unhideDiv, ToggleHide);
		unhideDiv.style.width = (btnHide.offsetWidth) + 'px';
		unhideDiv.style.height = (btnHide.offsetHeight) + 'px';
		barTable = document.getElementById('controls');
		barTable.style.transformOrigin = 'top left';
		barTable.style.whiteSpace = 'nowrap';
		barTable.style.padding = '1px';
		barTable.style.fontSize = '18pt';
		let barCell, innerTable, innerCell, innerRow;
		let barRow2 = barTable.insertRow();
		let barRow = barTable.insertRow();
		let padding = '0px 0.5ex 0px 0.5ex';
		barCell = barRow.insertCell();
		barCell.style.padding = padding;
		barCell.style.borderRight = '1px solid white';
		innerTable = CreateTable(barCell);
		innerCell = innerTable.insertRow().insertCell();
		innerCell.style.textAlign = 'center';
		CreateCheckbox('lock', 'lk', 'Prevent Play', 'Check this box to prevent accidental playing. See also "When a row is clicked"', innerCell, SetPlayButtonLock);
		innerCell = innerTable.insertRow().insertCell();
		innerCell.style.textAlign = 'center';
		CreateCheckbox('kp', 'kp', 'Keep Playing', 'Check this box if you wish to keep playing sound when tab loses focus', innerCell, SetKeepPlaying);
		innerCell = innerTable.insertRow().insertCell();
		btnPlay = CreateButton('buttonPlay', playIcon, 'Play', innerCell, DoPlay);
		btnStop = CreateButton('buttonPlay', stopIcon, 'Stop', innerCell, DoStop);
		currentNote = innerTable.insertRow().insertCell();
		currentNote.style.textAlign = 'center';
		currentNote.innerText = '-';
		let lab = (dataType == 1) ? "Time:" : "Bar:";
		let minWidth = 4.5;
		if (maxPosValue >= 100) minWidth = 6.5;
		if (dataType != 1)
		{
			style.BeginNew();
			style.Add('.com', "font-family:serif;color:yellow;background-color:transparent;width:1em;height:auto;font-size:300%;padding:0 0 0 0.2ex");
			style.Add('.num', "position:relative;top:0.5ex;");
			style.Add('.den', "position:relative;top:-0.5ex;");
			style.Finish();
			let outerTable = CreateTable(barRow.insertCell());
			outerTable.style.fontSize = '18pt';
			let aRow = outerTable.insertRow();
			innerTable = CreateTable(aRow.insertCell());
			numerator = innerTable.insertRow().insertCell();
			denominator = innerTable.insertRow().insertCell();
			numerator.className = 'com num';
			denominator.className = 'com den';
			numerator.innerText = positionData[0].BeatsPerBar;
			denominator.innerText = positionData[0].BeatSize;
			cellBarNo = aRow.insertCell();
			cellBarNo.style.padding = '0';
			let nc = 1;
			if (maxBar >= 100) nc = 3;
			else if (maxBar >= 10) nc = 2;
			cellBarNo.style.minWidth = nc + 'ch';
			cellBarNo.style.fontSize = '250%';
			cellBarNo.style.textAlign = 'right';
			cellBarNo.style.verticalAlign = 'middle';
			cellBarNo.innerHTML = positionData[0].Bar;
			barCell = aRow.insertCell();
			barCell.style.padding = '0';
			barCell.style.fontSize = '250%';
			barCell.style.verticalAlign = 'middle';
			barCell.innerText = ":";
			cellBeatNo = aRow.insertCell();
			cellBeatNo.style.paddingRight = '0.5ex';
			cellBeatNo.style.borderRight = '1px solid white';
			nc = 1;
			if (maxBeatsPerBar >= 10) nc = 2;
			cellBeatNo.style.minWidth = nc + 'ch';
			cellBeatNo.style.fontSize = '250%';
			cellBeatNo.style.textAlign = 'left';
			cellBeatNo.style.verticalAlign = 'middle';
			cellBeatNo.innerHTML = "1";
			innerCell = outerTable.insertRow().insertCell();
			innerCell.colSpan = '4';
			innerTable = CreateTable(innerCell);
			aRow = innerTable.insertRow();
			rangePos = CreateRange(minPosValue, minPosValue, maxPosValue);
			elePosition = CreateSpan(lab, rangePos, minPosValue + "/" + maxPosValue, aRow, minWidth);
			//aRow.insertCell().innerText = "Hello There Oh Great One";
		}
		else
		{
			rangePos = CreateRange(minPosValue, minPosValue, maxPosValue);
			elePosition = CreateSpan(lab, rangePos, minPosValue + "/" + maxPosValue, barRow, minWidth);
		}
		barCell = barRow.insertCell();
		barCell.style.padding = padding;
		barCell.style.borderRight = '1px solid white';
		innerTable = CreateTable(barCell);
		innerCell = innerTable.insertRow().insertCell();
		innerCell.innerText = 'When a row is clicked,';
		CreateRadio('nothing', 'RC', 'do nothing', 'When selected, clicking a row will have no effect', innerTable.insertRow().insertCell(), DoWhatOnClick);
		radioPlayOnClick = CreateRadio('play', 'RC', 'play music', 'When selected, the music will start playing at the point where the table is clicked', innerTable.insertRow().insertCell(), DoWhatOnClick);
		radioPlayOnClick.checked = true;
		CreateRadio('highlight', 'RC', 'highlight row only', 'When selected, the music will not play but row will be highlighted', innerTable.insertRow().insertCell(), DoWhatOnClick);
		playHow = 'play';
		barCell = barRow.insertCell();
		barCell.style.padding = padding;
		barCell.style.borderRight = '1px solid white';
		innerTable = CreateTable(barCell);
		btnInc = CreateButton('button', "A+", 'Increase Font Size', innerTable.insertRow().insertCell(), DoInc);
		btnNorm = CreateButton('button', "100<sup>%</sup>", 'Reset Font Size', innerTable.insertRow().insertCell(), DoNorm);
		btnNorm.style.backgroundColor = "gray";
		btnDec = CreateButton('button', "A-", 'Decrease Font Size', innerTable.insertRow().insertCell(), DoDec);
		barCell = barRow.insertCell();
		barCell.style.padding = padding;
		barCell.style.borderRight = '1px solid white';
		innerTable = CreateTable(barCell);
		CreateButton('button', 'Index', "Go to Index", innerTable.insertRow().insertCell(), Up1);
		CreateButton('button', 'Home', "Go to Main Index", innerTable.insertRow().insertCell(), Up2);
		if (dataType != 1)
		{
			barCell = barRow.insertCell();
			barCell.style.padding = padding;
			barCell.style.borderRight = '1px solid white';
			innerTable = CreateTable(barCell);
			innerCell = innerTable.insertRow().insertCell();
			innerCell.innerText = 'Sort';
			const dd = (event) => SortParts(event.srcElement.id);
			if (hasSop || hasLadies)  CreateRadio('SALTBM', 'SORT', 'SATB', 'Sort rows within each bar Sop, then Alto, then Tenor,then Bass', innerTable.insertRow().insertCell(), dd).checked = true;
			if (hasAlto || hasLadies) CreateRadio('ALTBMS', 'SORT', 'ATBS', 'Sort rows within each bar Alto, then Tenor, then Bass, then Sop', innerTable.insertRow().insertCell(), dd);
			if (hasTenor || hasMen) CreateRadio('TBMSAL', 'SORT', 'TBSA', 'Sort rows within each bar Tenor, then Bass, then Sop, then Alto', innerTable.insertRow().insertCell(), dd);
			if (hasBass || hasMen) CreateRadio('BMSALT', 'SORT', 'BSAT', 'Sort rows within each bar Bass, then Sop, then Alto, then Tenor', innerTable.insertRow().insertCell(), dd);
			barCell = barRow.insertCell();
			barCell.style.padding = padding;
			barCell.style.borderRight = '1px solid white';
			innerTable = CreateTable(barCell);
			innerCell = innerTable.insertRow().insertCell();
			innerCell.style.textAlign = 'center';
			innerCell.innerText = 'Visible Parts';
			if (hasSop || hasLadies) CreateCheckbox('S', 'SHR', 'Sop/Ladies', 'Uncheck to hide Sop, check to view Sop ', innerTable.insertRow().insertCell(), ShowHideRows).checked = true;
			if (hasAlto || hasLadies) CreateCheckbox('A', 'SHR', 'Alto/Ladies', 'Uncheck to hide Alto, check to view Alto', innerTable.insertRow().insertCell(), ShowHideRows).checked = true;
			if (hasTenor || hasMen) CreateCheckbox('T', 'SHR', 'Tenor/Men', 'Uncheck to hide Tenor, check to view Tenor', innerTable.insertRow().insertCell(), ShowHideRows).checked = true;
			if (hasBass || hasMen) CreateCheckbox('B', 'SHR', 'Bass/Men', 'Uncheck to hide Bass, check to view Bass', innerTable.insertRow().insertCell(), ShowHideRows).checked = true;
			if (hasOther) CreateCheckbox('z', 'SHR', 'Other', 'Uncheck to hide anything else, check to view anything else', innerTable.insertRow().insertCell(), ShowHideRows).checked = true;
			barCell = barRow.insertCell();
			barCell.style.padding = padding;
			if (mixer.count > 1) barCell.style.borderRight = '1px solid white';
			innerTable = CreateTable(barCell);
			innerCell = innerTable.insertRow().insertCell();
			innerCell.style.textAlign = 'center';
			innerCell.innerText = 'Show/Hide';
			CreateCheckbox('barHide', 'SHB', 'Bar/Sig', 'Check to view Signature and Bar column. Uncheck for more space', innerTable.insertRow().insertCell(), ToggleSignatureColumn).checked = true;
			CreateCheckbox('partHide', 'SHB', 'Part', 'Check to View Parts (S,A,T,B etc.) column. Uncheck for more space', innerTable.insertRow().insertCell(), TogglePartColumn).checked = true;
			if (mixer.count > 1)
			{
				barCell = barRow.insertCell();
				barCell.style.padding = padding;
				innerTable = CreateTable(barCell);
				innerRow = innerTable.insertRow();
				let m = ['Part', 'Volume', 'Pan'];
				for (let i = 0; i < 3; i++)
				{
					innerCell = innerRow.insertCell();
					innerCell.style.textAlign = 'center';
					innerCell.innerText = m[i];
				}
				for (let i = 0; i < mixer.count; i++)
				{
					let tr = mixer.getTrackByIndex(i);
					const vol = getSavedTrackValue('vol', tr.name, 1 / mixer.count);
					const lrPan = getSavedTrackValue('lrPan', tr.name, 0);
					let sliderVol = CreateRange(0, vol, 1, 0.05);
					sliderVol.className = 'sliderVol';
					sliderVol.style.width = '100px';
					let sliderPan = CreateRange(-1, lrPan, 1, 0.05);
					sliderPan.className = 'sliderPan';
					sliderPan.style.width = '50px';
					let row = innerTable.insertRow();
					row.insertCell().innerText = tr.name;
					row.insertCell().appendChild(sliderVol);
					row.insertCell().appendChild(sliderPan);
					sliderVol.addEventListener('input', (event) =>
					{
						tr.volume = sliderVol.value;
						saveTrackValue('vol', tr.name, sliderVol.value);
					});
					sliderPan.addEventListener('input', (event) =>
					{
						tr.pan = sliderPan.value;
						saveTrackValue('lrPan', tr.name, sliderPan.value);
					});
					if (mixer.use3D)
					{
						const fbPan = getSavedTrackValue('fbPan', tr.name, 0);
						let sliderPanFB = CreateRange(-1, fbPan, 1, 0.05);
						sliderPanFB.className = 'sliderPanFB';
						sliderPanFB.style.width = '50px';
						row.insertCell().appendChild(sliderPanFB);
						sliderPanFB.addEventListener('input', (event) =>
						{
							tr.panFB = sliderPanFB.value;
							saveTrackValue('fbPan', tr.name, sliderPanFB.value);
						});
						tr.panFB = fbPan;
					}
					tr.volume = vol;
					tr.pan = lrPan;
				}
			}
		}
		let rangeBass = CreateRange(0, 0, 100);
		let rangeTreble = CreateRange(0, 0, 100);
		let rangeSpeed = CreateRange(75, 100, 150, 5);
		let rangeVol = CreateRange(0, 50, 100);
		let nCells = Math.floor(barRow.cells.length);
		barCell = barRow2.insertCell();
		barCell.colSpan = nCells;
		barCell.style.padding = padding;
		div = document.createElement('div');
		div.style.display = 'flex';
		div.style.gap = '1em';
		div.style.width = '100%';
		barCell.appendChild(div);
		let row = innerTable.insertRow();
		let elePlaybackRate = CreateSpanNew('Speed:', rangeSpeed, "100%", div, minWidth);
		let elePlaybackVolume = CreateSpanNew('Volume:', rangeVol, "100%", div, minWidth);
		let eleBass = CreateSpanNew('Bass:', rangeBass, "100%", div, minWidth);
		let eleTreble = CreateSpanNew('Treble:', rangeTreble, "100%", div, minWidth);
		controlWidth = barTable.scrollWidth;
		controlHeight = barTable.scrollHeight;
		rangePos.onmouseout = function (ev)
		{
			blnPositioning = false;
			SetPosLabel();
		};
		function OnMouseMove(value,event, isTouch)
		{
			blnPositioning = true;
			if ((dataType & 2) != 0 && (isTouch || event.buttons === 1))
			{
				cellBeatNo.innerText = '1';
				cellBarNo.innerText = value;
			}
			elePosition.innerText = value + "/" + rangePos.max;
		}
		rangePos.onmousemove = function (ev)
		{
			let v = GetPos(rangePos, ev);
			OnMouseMove(v, ev, false);
		};
		rangePos.ontouchmove = function (ev)
		{
			let v = GetPos(rangePos, ev.touches[0]);
			OnMouseMove(v, ev, true);
		};
		rangePos.onmouseup = function (ev)
		{
			blnPositioning = false;
			SetMediaPosition(ev);
		};
		rangePos.ontouchend = function (ev)
		{
			blnPositioning = false;
			if (ev.changedTouches && ev.changedTouches.length > 0)
			{
				SetMediaPosition(ev.changedTouches[0]);
			} else
			{
				SetMediaPosition(ev);
			}
		}
		rangeSpeed.oninput = function ()
		{
			let n = Math.floor(this.value / 5) * 5;
			elePlaybackRate.innerText = n + "%";
			mixer.playbackRate = n / 100;
			this.value = n;
		};
		rangeBass.oninput = function ()
		{
			SetBass(this.value);
		};
		rangeTreble.oninput = function ()
		{
			SetTreble(this.value);
		};
		rangeVol.oninput = function ()
		{
			SetVolume(this.value);
		};
		function SetVolume(value)
		{
			value = Math.floor(value);
			if (value < 0) value = 0;
			else if (value > 100) value = 100;
			mixer.volume = value / 100;
			rangeVol.value = value;
			elePlaybackVolume.innerText = value + '%';
			saveValue('Volume', value);
		}
		function SetBass(value)
		{
			value = Math.floor(value);
			if (value < 0) value = 0;
			else if (value > 100) value = 100;
			mixer.bass = value / 10;
			rangeBass.value = value;
			eleBass.innerText = value + '%';
			saveValue('Bass', value);
		}
		function SetTreble(value)
		{
			value = Math.floor(value);
			if (value < 0) value = 0;
			else if (value > 100) value = 100;
			mixer.treble = value / 5;
			rangeTreble.value = value;
			eleTreble.innerText = value + '%';
			saveValue('Treble', value);
		}
		function SortParts(order)
		{
			sortParts(order);
			const cb = document.getElementById(order);
			if (cb)
			{
				cb.checked = true;
				saveValue("SortParts", order)
			}
		}
		if (dataType == 1)
		{
			mixer.ontimeupdate = function ()
			{
				if (blnPositioning) return;
				SetPosLabel(mixer.currentPosition);
			}
		}
		SetVolume(getValue('Volume', 25));
		SetBass(getValue('Bass', 50));
		SetTreble(getValue('Treble', 50));
		SortParts(getValue('SortParts', 'SALTBM'));
		UnhideBar();
		document.body.addEventListener('dblclick', UnhideBar);
		mixer.addEventListener('pause', OnPause);
		mixer.addEventListener('play', OnResumeOrPlay);
		mixer.addEventListener('ended', OnPlayEnd);
		window.addEventListener('resize',  EnsureCorrectSizes);
		UpdateStatus();
	}
	function Up1()
	{
		window.location.href = '../index.html';
	}
	function Up2()
	{
		window.location.href = '../../index.html';
	}
	function SetVolume(value)
	{
		value = Math.floor(value);
		if (value < 0) value = 0;
		else if (value > 100) value = 100;
		mixer.volume = value / 100;
		rangeVol.value = value;
		elePlaybackVolume.innerText = value + '%';
	}
	function CreateButton(className, text, tooltip, parent, clickEvent)
	{
		let btn = document.createElement('button');
		btn.className = className;
		btn.innerHTML = text;
		btn.title = tooltip;
		btn.data = btn.style.color;
		btn.addEventListener('mouseover', ColorButton);
		btn.addEventListener('mouseout', UncolorButton);
		btn.addEventListener('mousedown', ShiftButton);
		btn.addEventListener('mouseup', ResetTransform)
		btn.addEventListener('touchstart', ShiftButton);
		btn.addEventListener('touchend', ResetTransform);
		btn.addEventListener('click', clickEvent);
		parent.appendChild(btn);
		return btn;
	}
	function ShiftButton(ev)
	{
		ev.target.style.transform = 'translate(1px, 1px)';
	}
	function ColorButton(ev)
	{
		ev.target.data = ev.target.style.color;
		ev.target.style.color = '#FF8080';
	}
	function UncolorButton(ev)
	{
		ev.target.style.color = ev.target.data;
		ResetTransform(ev);
	}
	function ResetTransform(ev)
	{
		ev.target.style.transform = 'translate(0px, 0px)';
		ev.target.style.color = ev.target.data;
	}
	function CreateRange(min, value, max, step = 1)
	{
		let range = document.createElement('input');
		range.type = 'range';
		range.min = min;
		range.step = step;
		range.value = value;
		range.max = max;
		return range;
	}
	function CreateTable(parent)
	{
		let table = document.createElement('table');
		let style = table.style;
		style.border = "0px none black;";
		style.borderCollapse = 'collapse';
		style.padding = '1px';
		style.color = 'white';
		style.fontSize = '10pt';
		parent.appendChild(table);
		return table;
	}
	function CreateSpanNew(textLeft, range, textRight, parentCell, minLength)
	{
		let div = document.createElement('div');
		div.style.flex = '1';
		parentCell.appendChild(div);
		let table = CreateTable(div);
		let parentRow = table.insertRow();
		let cell = parentRow.insertCell();
		cell.style.textAlign = 'right';
		cell.innerText = textLeft;
		cell.style.verticalAlign = 'middle';
		cell = parentRow.insertCell();
		cell.style.verticalAlign = 'middle';
		cell.appendChild(range);
		cell = parentRow.insertCell();
		cell.style.textAlign = 'right';
		cell.style.verticalAlign = 'middle';
		cell.style.minWidth = minLength + "ch";
		cell.innerText = textRight;
		return cell;
	}
	function CreateSpan(textLeft, range, textRight, parentRow, minLength)
	{
		let cell = parentRow.insertCell();
		cell.style.textAlign = 'right';
		cell.innerText = textLeft;
		cell.style.verticalAlign = 'middle';
		cell = parentRow.insertCell();
		cell.style.verticalAlign = 'middle';
		cell.appendChild(range);
		if (textRight.length == 0) return null;
		cell = parentRow.insertCell();
		cell.style.textAlign = 'right';
		cell.style.verticalAlign = 'middle';
		cell.style.minWidth = minLength + "ch";
		cell.innerText = textRight;
		return cell;
	}
	function CreateRadio(id, name, text, title, parentElement, clickEventCallback)
	{
		let radio = document.createElement('input');
		radio.type = 'radio';
		radio.id = id;
		radio.name = name;
		radio.checked = false;
		let label = document.createElement('label');
		label.htmlFor = id;
		label.style.color = 'white';
		label.textContent = text;
		label.title = title;
		parentElement.appendChild(radio);
		parentElement.appendChild(label);
		radio.addEventListener('click', clickEventCallback);
		return radio;
	}
	function DoWhatOnClick(event)
	{
		if (playHow === event.srcElement.id) return;
		playHow = event.srcElement.id;
		if (playHow === 'play') UnlockPlayOnRowClick();
		else LockPlayOnRowClick();
	}
	function DoSort(event)
	{
		let how = event.srcElement.id;
		SortParts(how);
	}
	function ShowHideRows(event)
	{
		const eles=document.getElementsByName('SHR')
		if (event.ctrlKey)
		{
			for (const element of eles)
			{
				if (element == event.srcElement) element.checked = true;
				else element.checked = false;
			}
		}
		let theRows = '';
		for (const element of eles)
		{
			theRows += element.id;
			if (element.checked) theRows += 'V';
			else theRows += 'H';
		}
		if (theRows.indexOf('AV') >= 0 || theRows.indexOf('SV') >= 0) theRows += 'LV'; else theRows += 'LH';
		if (theRows.indexOf('BV') >= 0 || theRows.indexOf('TV') >= 0) theRows += 'MV'; else theRows += 'MH';
		if (theRows.indexOf('LV') >= 0 || theRows.indexOf('MV') >= 0) theRows += 'EV'; else theRows += 'EH';
		ShowParts(theRows);
	}
	function CreateCheckbox(id, groupName, text, title, parentElement, clickEvent)
	{
		let checkBox = document.createElement('input');
		checkBox.type = 'checkbox';
		checkBox.id = id;
		checkBox.checked = false;
		checkBox.name = groupName;
		let label = document.createElement('label');
		label.htmlFor = id;
		label.style.color = 'white';
		label.style.fontSize = '10pt';
		label.innerHTML = text;
		label.title = title;
		parentElement.appendChild(checkBox);
		parentElement.appendChild(label);
		checkBox.addEventListener('click', clickEvent);
		return checkBox;
	}
	let resizer = document.getElementById('resizer');
	const lyricPanel = document.getElementById('lyricPanel');
	const scorePanel = resizer===null?null:document.getElementById('scorePanel');
	let isInternallyResizing = false;
	let playHow;
	function MoreSetup()
	{
		function CancelInternalResize()
		{
			if (isInternallyResizing)
			{
				isInternallyResizing = false;
				document.body.style.cursor = 'default';
				scoreSrc.style.display = "block";
				resizer.style.backgroundColor = 'dodgerblue';
				EnsureCorrectSizes();
				CheckFontSizes();
			}
		}
		if (resizer != null)
		{
			resizer.onmousedown = function (ev)
			{
				if (ev.buttons != 1) return;
				ResizerStart(ev);
			};
			resizer.ontouchstart = function (ev)
			{
				ResizerStart(ev);
			};
			function ResizerStart(ev)
			{
				isInternallyResizing = false;
				resizer.style.backgroundColor = 'red';
				scoreSrc.style.display = "none";
				document.body.style.cursor = blnLeftToRight ? 'ew-resize' : 'ns-resize';
				isInternallyResizing = true;
			}
			document.ontouchend = function (ev)
			{
				CancelInternalResize();
			}
			document.onmouseup = function (ev)
			{
				CancelInternalResize();
			}
		}
		document.addEventListener('mousemove', (e) =>
		{
			if (!isInternallyResizing) return;
			if (e.buttons != 1)
			{
				CancelInternalResize();
				return;
			}
			DoInternalResizing(e.clientX, e.clientY);
		});
		document.ontouchmove = function (ev)
		{
			if (!isInternallyResizing) return;
			DoInternalResizing(ev.touches[0].clientX, ev.touches[0].clientY);
		};
	}
	function DoInternalResizing(x,y)
	{
		if (blnLeftToRight)
		{
			let newWidthForLyricPanel = x;
			if (container.style.flexDirection === 'row-reverse')
			newWidthForLyricPanel = InnerWidth() - newWidthForLyricPanel;
			lyricPanel.style.flexBasis = newWidthForLyricPanel + 'px';
			lyricPanel.style.width = newWidthForLyricPanel + 'px';
			sizeRatio = lyricPanel.offsetWidth / container.offsetWidth;
		}
		else
		{
			let newHeightForLyricPanel = y;
			if (container.style.flexDirection === 'column-reverse')
			newHeightForLyricPanel = InnerHeight() - newHeightForLyricPanel;
			if (blnBarVisible) newHeightForLyricPanel -= topBar.clientHeight;
			lyricPanel.style.flexBasis = newHeightForLyricPanel + 'px';
			lyricPanel.style.height = newHeightForLyricPanel + 'px';
			sizeRatio = newHeightForLyricPanel / container.offsetHeight;
		}
		EnsureCorrectSizes();
	}
	function ShowScore()
	{
		window.open(scoreSourceAddress, 'TheScores');
	}
	function Swap()
	{
		let dir = container.style.flexDirection;
		if (dir === 'row') dir = 'row-reverse';
		else if (dir === 'row-reverse') dir = 'row';
		else if (dir === 'column') dir = 'column-reverse';
		else dir = 'column';
		container.style.flexDirection = dir;
	}
	let blnLeftToRight = true;
	function SetHorizontalLayout()
	{
		blnLeftToRight = true;
		container.style.flexDirection = 'row';
		let avail = container.offsetWidth - resizerSize;
		let w = avail + 'px';
		if (resizerSize > 0)
		{
			resizer.style.height = '100%';
			resizer.style.width = resizerSize + 'px';
			resizer.style.cursor = 'ew-resize';
			w = (avail / 2) + 'px';
			scorePanel.style.flexBasis = w;
			scorePanel.style.width = w;
		}
		lyricPanel.style.flexBasis = w;
		lyricPanel.style.width = w;
		EnsureCorrectSizes();
	}
	function SetVerticalLayout()
	{
		blnLeftToRight = false;
		if (resizer === null) return;
		container.style.flexDirection = 'column';
		resizer.style.width = '100%';
		resizer.style.height = resizerSize+'px';
		resizer.style.cursor = 'ns-resize';
		let avail = container.offsetHeight - resizerSize;
		let h = (avail / 2) + 'px';
		lyricPanel.style.flexBasis = h;
		lyricPanel.style.height = h;
		scorePanel.style.flexBasis = h;
		scorePanel.style.height = h;
		EnsureCorrectSizes();
	}
	function ChangeOrientation()
	{
		if (blnLeftToRight) SetVerticalLayout();
		else SetHorizontalLayout();
	}
	let waitAbit;
	function DoExternalResize()
	{
		FixTopBar();
		MakeSureLyricPanelCorrectSize();
		clearTimeout(waitAbit);
		waitAbit = setTimeout(CheckFontSizes, 400);
	}
	function FixTopBar()
	{
		let scale = 1;
		barTable.style.transform = 'none';
		barTable.style.transformOrigin = 'top left';
		let ratio = controlHeight / window.innerHeight;
		const maxRat = 0.2;
		if (ratio > maxRat) scale = maxRat / ratio;
		if (scale * controlHeight < 50) scale = 50 / controlHeight;
		container.style.width = window.innerWidth + "px";
		container.style.height = InnerHeight() + "px";
		if (controlWidth > window.innerWidth)
		{
			let test = window.innerWidth / controlWidth;
			if (test < scale) scale = test;
		}
		let w = (window.innerWidth - scale * controlWidth)/2;
		barTable.style.transform = 'scale(' + scale + ') translateX(' + w + 'px)';
		let rect = barTable.getBoundingClientRect();
		let pad = 2;
		topBar.style.paddingTop = pad + "px";
		barThickness = rect.height +2*pad;
		topBar.style.height = barThickness + "px";
		EnsureCorrectSizes();
	}
	let isPaused= false;
	function BeforePrint()
	{
		isPaused = mixer.paused;
		mixer.pause();
		UnhighlightRow();
		StopMonitor();
		CheckFontSizes();
	}
	function AfterPrint()
	{
		if (!isPaused) mixer.play();
	}
	function saveTrackValue(what, trackName, value)
	{
		if (!blnReady) return;
		const name = what + "_" + trackName;
		saveValue(name, value);
	}
	function getSavedTrackValue(what, trackName, defaultValue)
	{
		const name = what + "_" + trackName;
		let value = getValue(name, defaultValue);
		return value;
	}
	async function DoItAll()
	{
		if (allOK === false || allOK === null)
		{
			document.getElementById('container').style.display = 'none';
			document.write("<span color='red'>Too Many Login Attempts</span>");
			return;
		}
		let arr = (typeof arrSources !== "undefined") ? arrSources : [];
		let theSongs = arr;
		if (arr.length == 0)
		{
			arr = [
			new Item("Orig", "Song.mp3", 0,false),
			new Item("Sop", "SongS.mp3", 1, true),
			new Item("Alto", "SongA.mp3", -1, true),
			new Item("Tenor", "SongT.mp3", 1, true),
			new Item("Bass", "SongB.mp3", -1, true),
			new Item("Music", "SongM.mp3", 0,false)
			];
			const checkPromises = arr.map(async (item) =>
			{
				const exists = await checkFileExists("./" + item.audioUrl);
				return exists ? item : null;
			});
			const results = await Promise.all(checkPromises);
			theSongs = results.filter(item => item !== null);
		}
		let promise = null;
		if (theSongs.length> 0)
		{
			mixer = new AudioMixer();
			for (let i = 0; i < theSongs.length; i++)
			{
				const track = new AudioTrack(mixer, theSongs[i].name, theSongs[i].audioUrl, theSongs[i].pan, theSongs[i].makeMono);
				mixer.addTrack(track);
			}
			promise = mixer.loadTracks();
		}
		else
		{
			mixer = new AudioController();
			promise = await mixer.load('Song.mp3');
		}
		await Setup();
		mixer.currentPosition = theBegining;
		if (!isTouchDeviceOrNoScores) MoreSetup();
		container.style.display = 'flex';
		SetHorizontalLayout();
		window.addEventListener("beforeprint", BeforePrint);
		window.addEventListener("afterprint", AfterPrint);
		window.addEventListener('resize', DoExternalResize);
		FixTopBar();
		setTimeout(CheckFontSizes,250);
		SetKeepPlaying();
		if (promise != null) await promise;
		document.getElementById('message').style.display = 'none';
		document.getElementById('pardiv').setAttribute('aria-busy', 'false');
		Object.defineProperty(DOMRect.prototype, 'contains', {
		value: function (x,y)
		{
			if (x < this.left || y < this.top||x>this.right||y>this.bottom) return false;
			return  true;
		},
		enumerable: false
	});
	document.addEventListener('mousemove', ShowNote);
	blnReady = true;
}
function ShowNote(event)
{
	const noteElement = event.target.closest('x[v]') || event.target.querySelector('x[v]');
	if (noteElement)
	{
		var rect = noteElement.getBoundingClientRect();
		if (rect.contains(event.clientX, event.clientY))
		{
			currentNote.innerText = noteElement.getAttribute('v');
			return;
		}
		else
		{
			//let d = event.clientY - y;
		}
	}
	currentNote.innerText = '-';
}
class AudioController extends EventTarget
{
	constructor()
	{
		super();
		this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		this.audioElement = new Audio();
		this.audioElement.crossOrigin = "anonymous";
		this.sourceNode = this.audioCtx.createMediaElementSource(this.audioElement);
		this.gainNode = this.audioCtx.createGain();
		this.gainNode.gain.value = 2.5;
		this.bassFilter = this.audioCtx.createBiquadFilter();
		this.bassFilter.type = "lowshelf";
		this.bassFilter.frequency.value = 200;
		this.bassFilter.gain.value = 0;
		this.trebleFilter = this.audioCtx.createBiquadFilter();
		this.trebleFilter.type = "highshelf";
		this.trebleFilter.frequency.value = 3000;
		this.trebleFilter.gain.value = 0;
		this.sourceNode.connect(this.gainNode);
		this.gainNode.connect(this.bassFilter);
		this.bassFilter.connect(this.trebleFilter);
		this.trebleFilter.connect(this.audioCtx.destination);
		this.startTime = 0;
		this.elapsedOffset = 0;
		this.isPlaying = false;
		this._setupEventForwarding();
	}
	async load(url)
	{
		this.audioElement.src = url;
		return new Promise((resolve, reject) =>
		{
			const onLoad = () =>
			{
				this.audioElement.removeEventListener('error', onError);
				resolve();
			};
			const onError = (error) =>
			{
				this.audioElement.removeEventListener('loadedmetadata', onLoad);
				reject(new Error(`Failed to load audio: ${error.message || 'Unknown error'}`));
			};
			this.audioElement.addEventListener('loadedmetadata', onLoad, { once: true });
			this.audioElement.addEventListener('error', onError, { once: true });
		});
	}
	play()
	{
		if (this.isPlaying) return;
		if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
		this.startTime = this.audioCtx.currentTime;
		this.audioElement.play();
		this.isPlaying = true;
	}
	pause()
	{
		if (!this.isPlaying) return;
		this.audioElement.pause();
		this.elapsedOffset += (this.audioCtx.currentTime - this.startTime) * this.playbackRate;
		this.isPlaying = false;
	}
	stop()
	{
		this.pause();
		this.currentTime = 0;
	}
	get paused()
	{
		return (!this.isPlaying);
	}
	#vScale = 2.0;
	get volume()
	{
		return this.gainNode ? this.gainNode.gain.value / this.#vScale : 1.0;
	}
	set volume(value)
	{
		const normalizedValue = this.#vScale * Math.max(0, Math.min(1, value));
		if (this.gainNode && this.audioCtx)
		{
			this.gainNode.gain.value = normalizedValue;
		}
	}
	get bass()
	{
		return this.bassFilter ? this.bassFilter.gain.value : 0;
	}
	set bass(value)
	{
		if (this.bassFilter && this.audioCtx)
		{
			this.bassFilter.gain.setValueAtTime(value, this.audioCtx.currentTime);
		}
	}
	get treble()
	{
		return this.trebleFilter ? this.trebleFilter.gain.value : 0;
	}
	set treble(value)
	{
		if (this.trebleFilter && this.audioCtx)
		{
			this.trebleFilter.gain.setValueAtTime(value, this.audioCtx.currentTime);
		}
	}
	get echoTime()
	{
		return this.delayNode ? this.delayNode.delayTime.value : 0.3;
	}
	set echoTime(value)
	{
		if (value < 0) value = 0;
		else if (value > 1) value = 1;
		if (this.delayNode && this.audioCtx)
		{
			console.log("echo " + value);
			this.delayNode.delayTime.setValueAtTime(value, this.audioCtx.currentTime);
			console.log("echoTime " + this.echoTime);
		}
	}
	get baseLatency()
	{
		return this.audioCtx.baseLatency || 0;
	}
	get outputLatency()
	{
		return this.audioCtx.outputLatency || 0;
	}
	get currentPosition()
	{
		if (!this.isPlaying)
		{
			return this.elapsedOffset;
		}
		const currentRunTime = (this.audioCtx.currentTime - this.startTime) * this.playbackRate;
		const rawSongTime = this.elapsedOffset + currentRunTime;
		const outputLag = this.audioCtx.outputLatency || 0;
		const baseLag = this.audioCtx.baseLatency || 0;
		const totalHardwareLag = outputLag + baseLag;
		return Math.max(0, rawSongTime - totalHardwareLag);
	}
	set currentPosition(seconds)
	{
		this.elapsedOffset = Math.max(0, Math.min(seconds, this.duration));
		this.audioElement.currentTime = this.elapsedOffset;
		if (this.isPlaying)
		{
			this.startTime = this.audioCtx.currentTime;
		}
	}
	get playbackRate()
	{
		return this.audioElement.playbackRate;
	}
	set playbackRate(speed)
	{
		const targetSpeed = Math.max(0.1, speed);
		if (this.isPlaying)
		{
			this.elapsedOffset += (this.audioCtx.currentTime - this.startTime) * this.playbackRate;
			this.startTime = this.audioCtx.currentTime;
		}
		this.audioElement.playbackRate = targetSpeed;
	}
	get duration()
	{
		return this.audioElement.duration || 0;
	}
	_setupEventForwarding()
	{
		this._boundPlay = () => this.dispatchEvent(new Event('play'));
		this._boundPause = () => this.dispatchEvent(new Event('pause'));
		this._boundRateChange = () => this.dispatchEvent(new Event('ratechange'));
		this._boundEnded = () =>
		{
			this.isPlaying = false;
			this.elapsedOffset = 0;
			this.dispatchEvent(new Event('ended'));
		};
		this.audioElement.addEventListener('play', this._boundPlay);
		this.audioElement.addEventListener('pause', this._boundPause);
		this.audioElement.addEventListener('ratechange', this._boundRateChange);
		this.audioElement.addEventListener('ended', this._boundEnded);
	}
	async destroy()
	{
		if (this.isPlaying)
		{
			this.audioElement.pause();
			this.isPlaying = false;
		}
		this.audioElement.src = "";
		this.audioElement.load();
		if (this._boundPlay) this.audioElement.removeEventListener('play', this._boundPlay);
		if (this._boundPause) this.audioElement.removeEventListener('pause', this._boundPause);
		if (this._boundRateChange) this.audioElement.removeEventListener('ratechange', this._boundRateChange);
		if (this._boundEnded) this.audioElement.removeEventListener('ended', this._boundEnded);
		if (this.sourceNode)
		{
			this.sourceNode.disconnect();
		}
		if (this.audioCtx && this.audioCtx.state !== 'closed')
		{
			await this.audioCtx.close();
		}
		this.audioElement = null;
		this.sourceNode = null;
		this.audioCtx = null;
	}
}
setTimeout(DoItAll, 0);
