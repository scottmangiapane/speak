const errors = document.getElementById('errors');
const form = document.getElementById('form');
const input = document.getElementById('input');
const response = document.getElementById('response');
const speak = document.getElementById('speak');
const reset = () => {
	errors.innerHTML = '';
	response.style.display = 'none';
};
input.oninput = reset;
form.onsubmit = (e) => {
	e.preventDefault();
	reset();
	speak.disabled = true;
	const req = new XMLHttpRequest();
	req.open('POST', '/api', true);
	req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
	req.onload = () => {
		const res = JSON.parse(req.responseText || '{}');
		if (!!res.errors) {
			res.errors.forEach(err => {
				errors.innerHTML += '<div class="spacer"></div>';
				errors.innerHTML += `<p class="text-error text-small">${ err }</p>`;
			});
		} else {
			response.style.display = 'inline-block';
		}
		speak.disabled = false;
	}
	req.send(`message=${ input.value }`);
};
