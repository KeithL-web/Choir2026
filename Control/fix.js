function PartCell(part, letter)
{
	return "<td brt w20><table inline " + letter + "_BG><tr><td parts>" + part + "</td></tr></table></td>";
}
function GetLetter(part)
{
	if ("SATBMLE".indexOf(part, 0) >= 0) return part;
	return "O";
}
let theOrder;
function MySort(a, b)
{
	const attA = a.getAttribute('PL');
	const attB = b.getAttribute('PL');
	if (attA === attB) return 0;
	let valA = theOrder.indexOf(attA);
	if (valA < 0) valA = 999;
	let valB = theOrder.indexOf(attB);
	if (valB < 0) valB = 999;
	return valA - valB;
}
function showParts(parts)
{
	const tables = document.querySelectorAll("table[fx]");
	let m = tables.length;
	parts += '!H';
	for (let t = 0; t < m; t++)
	{
		let rows = tables[t].querySelectorAll('tr[PL]');
		let gotVis = false;
		for (let i = 0; i < rows.length; i++)
		{
			let att = rows[i].getAttribute('PL');
			if ('SATBMLE!'.indexOf(att) < 0) att = 'z';
			const ind = parts.indexOf(att);
			if (ind >= 0)
			{
				let vis = parts[ind + 1];
				if (vis === 'V')
				{
					rows[i].style.display = 'table-row';
					gotVis = true;
				}
				else rows[i].style.display = 'none';
			}
		}
		if (!gotVis)
		{
			rows[rows.length-1].style.display = 'table-row';
		}
	}
}
function sortParts(order)
{
	theOrder = order;
	const tables = document.querySelectorAll("table[fx]");
	let m = tables.length;
	for (let t = 0; t < m; t++)
	{
		let nc = tables[t].getAttribute('cs');
		if (nc)
		{
			let aRow = document.createElement('tr');
			let aCell = aRow.insertCell();
			aCell.setAttribute('w20', '');
			aCell.setAttribute('brt', '');
			let w = (100 / nc) + '%';
			for (let c = 0; c < nc; c++)
			{
				aCell = aRow.insertCell();
				aCell.style.width = w;
				aCell.style.maxWidth = w;
			}
			tables[t].prepend(aRow);
		}
		let rows = tables[t].querySelectorAll('tr[PL]');
		const forSorting = [...rows];
		if (forSorting.length > 1)
		{
			forSorting.sort(MySort);
			let tBody = tables[t].querySelector('tbody');
			forSorting.forEach(row =>
			{
				tBody.appendChild(row);
			});
		}
	}
}
let hasSop = false, hasAlto = false, hasBass = false, hasTenor = false;
let hasMen = false, hasLadies = false, hasAll = false, hasOther = false;
function FixRows(data)
{
	let tabs = document.getElementsByTagName('table');
	let m = tabs.length;
	let useData = (data != undefined);
	for (let t = 0; t < m; t++)
	{
		let table = tabs[t];
		if (table.hasAttribute('fx'))
		{
			let rows = table.rows;
			for (let r = 0; r < rows.length; r++)
			{
				let row = rows[r];
				if (row.hasAttribute('tot'))
				{
					const top = VO_ToOffset(row.getAttribute('VO'));
					const height = H_ToHeight(row.getAttribute('H'));
					let part = row.getAttribute('PL');
					switch (part)
					{
						case 'S': hasSop = true; break;
						case 'A': hasAlto = true; break;
						case 'T': hasTenor = true; break;
						case 'B': hasBass = true; break;
						case 'M': hasMen = true; break;
						case 'L': hasLadies = true; break;
						case 'E': hasAll = true; break;
						case '!': break;
						default: hasOther = true; break;
					}
					if (part != null)
					{
						let letter = GetLetter(part);
						row.setAttribute(letter + '_FG', '');
					}
					const images = row.querySelectorAll('img');
					for (let i = 0; i < images.length; i++)
					{
						let image = images[i];
						if (image.hasAttribute('st'))
						{
							if (useData)
							image.src = data;
							else
							{
								image.src = '../../Control/Staff' + image.getAttribute('st') + '.svg';
							}
							image.setAttribute('STIM', '');
							let div = image.parentElement;
							div.setAttribute('PEN', '');
							div.setAttribute('PR', '');
							div.style.top = top;
							div.style.height = height;
							image.nextElementSibling.setAttribute('OVLIM', '');
						}
					}
				}
			}
		}
	}
	sortParts("SALTBM");
	let elements = document.querySelectorAll('td[w]');
	for (let i = 0; i < elements.length; i++)
	{
		const el = elements[i];
		el.style.width = el.getAttribute('w') / 100 + '%';
	}
	elements = document.querySelectorAll('div[H]');
	for (let i = 0; i < elements.length; i++)
	{
		const el = elements[i];
		el.style.height = H_ToHeight(el.getAttribute('H'));
	}
	elements = document.querySelectorAll('x[VA], span[VA]');
	for (let i = 0; i < elements.length; i++)
	{
		const el = elements[i];
		el.style.verticalAlign = VA_ToOffset(el.getAttribute('VA'));
	}
	const up = '\u2191';
	const upRight = '\u2197';
	const right = '\u2192';
	const down = '\u2193';
	const downRight = '\u2198';
	elements = document.querySelectorAll('w[d]');
	for (let i = 0; i < elements.length; i++)
	{
		const el = elements[i];
		const diff = el.getAttribute('d');
		const z = document.createElement('z');
		z.innerText = Math.abs(diff);
		const oct = (Math.floor(diff / 7) * 7) === diff;
		let color;
		if (oct)
		{
			color = diff < 0 ? 'blue' : 'red';
		}
		else
		{
			const computedStyle = window.getComputedStyle(el);
			let hex = HexColor(computedStyle.color);
			hex &= 0xFFFFFF;
			hex >>>= 0;
			hex = ~hex;
			hex &= 0xFCFCFC;
			hex >>>= 2;
			hex = ~hex;
			hex &= 0xFFFFFF;
			hex >>>= 0;
			color = diff < 0 ? "#" + hex.toString(16): 'white';
		}
		z.style.background = color;
		el.after(z);
		let ind;
		if (diff >= 4) ind = up;
		else if (diff > 0) ind = upRight;
		else if (diff == 0) ind = right;
		else if (diff <= -4) ind = down;
		else ind = downRight;
		el.innerText += ind;
	}
}
const canvasContext = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
;
function HexColor(colorName)
{
	canvasContext.fillStyle = colorName;
	canvasContext.fillRect(0, 0, 1, 1);
	const [r, g, b, a] = canvasContext.getImageData(0, 0, 1, 1).data;
	return (b + (g << 8) + (r << 16) + (255 << 24)) >>> 0;
}
function AddCSS(css)
{
	const style = document.createElement('style');
	style.textContent = css;
	document.head.appendChild(style);
	return style;
}
const waitSheet = AddCSS('*{ cursor: wait !important; }');
waitSheet.disabled = true;
let cursorDepth = 0;
let renderPromise = null;
const yieldForRender = () => new Promise(resolve =>
{
	requestAnimationFrame(() =>
	{
		requestAnimationFrame(resolve);
	});
});
async function IncMouse()
{
	cursorDepth++;
	if (cursorDepth === 1)
	{
		document.body.style.pointerEvents = "none";
		waitSheet.disabled = false;
		renderPromise = yieldForRender();
	}
	if (renderPromise) await yieldForRender();
}
function DecMouse()
{
	if (cursorDepth >= 1)
	{
		cursorDepth--;
		if (cursorDepth === 0)
		{
			renderPromise = null;
			waitSheet.disabled = true;
			document.body.style.pointerEvents = "auto";
		}
	}
}
async function CheckFontSizes()
{
	await IncMouse();
	try
	{
		let yTags = document.getElementsByTagName('y');
		for (let c = 0; c < yTags.length; c++)
		{
			let yTag = yTags[c];
			yTag.style.transform = '';
			let cell = yTag.closest('td');
			let sw = cell.scrollWidth;
			let cw = cell.clientWidth;
			if (cw < sw)
			{
				let scale = cw / sw;
				if (scale < 0.2) scale = 0.2;
				yTag.style.transform = 'scaleX(' + scale + ')';
			}
		}
	}
	finally
	{
		DecMouse();
	}
}
