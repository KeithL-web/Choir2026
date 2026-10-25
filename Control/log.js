async function generateBrowserHash(message)
{
	const msgBuffer = new TextEncoder().encode(message);
	const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	return hashHex;
}
const hash = "b6108a855cf33164f47f19b67f0b215806584b0f4a66991c8a02f6d15da0a609";
let allOK = null;
async function CheckOK()
{
	if (sessionStorage.getItem("pw") === "true")
	{
		allOK = true;
		return true;
	}
	if (allOK != null) return allOK;
	let count = 0;
	let pw = "";
	let mess = "Please enter your password";
	allOK = false;
	again:
	while (true)
	{
		pw = prompt(mess, pw);
		if (pw == null)
		{
			allOK = false;
			return false;
		}
		const hashed = await generateBrowserHash(pw);
		if (hashed != hash)
		{
			count++;
			mess = "Incorrect. " + count + " of 4 attempts. Please try again";
			if (count < 4) continue again;
			return false;
		}
		sessionStorage.setItem("pw", "true");
		allOK = true;
		return true;
	}
}
CheckOK();
