const DISMISSED_KEY = 'safar-rakshak.registration-dismissed.v1';
const $ = (selector, root = document) => root.querySelector(selector);
let currentAccount = null;
let csrfToken = null;
let accountLoadFailed = false;

function dispatchAccountChange(account, created = false) {
  window.dispatchEvent(new CustomEvent('safar-account-change', {
    detail: { account, created }
  }));
}

function setAccountStatus(message, isError = false, selector = '#accountStatus') {
  const status = $(selector);
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function updateAccountArea() {
  const area = $('#accountArea');
  if (!area) return;
  area.replaceChildren();

  if (currentAccount) {
    const label = document.createElement('span');
    label.className = 'account-label';
    label.textContent = `Signed in as ${currentAccount.fullName}`;
    const signOut = document.createElement('button');
    signOut.type = 'button';
    signOut.className = 'button button-outline button-small';
    signOut.textContent = 'Sign out';
    signOut.addEventListener('click', async () => {
      signOut.disabled = true;
      try {
        await apiRequest('/api/auth/logout', { method: 'POST' });
        currentAccount = null;
        csrfToken = null;
        updateAccountArea();
        dispatchAccountChange(null);
      } catch (error) {
        console.error('Could not sign out:', error);
        setAccountStatus(error.message || 'Could not sign out. Try again.', true, '#accountAreaStatus');
        signOut.disabled = false;
      }
    });
    area.append(label, signOut);
  } else {
    if (accountLoadFailed) {
      const message = document.createElement('span');
      message.className = 'status error';
      message.id = 'accountAreaStatus';
      message.setAttribute('role', 'alert');
      message.textContent = 'Could not connect to your account. ';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'dialog-switch';
      retry.textContent = 'Retry';
      retry.addEventListener('click', () => {
        retry.disabled = true;
        loadSession(true).finally(() => {
          if (retry.isConnected) retry.disabled = false;
        });
      });
      message.append(retry);
      area.append(message);
    }

    const signIn = document.createElement('button');
    signIn.type = 'button';
    signIn.className = 'button button-outline button-small';
    signIn.textContent = 'Register / sign in';
    signIn.addEventListener('click', () => openDialog('register'));
    area.append(signIn);
  }
}

async function loadSession(notify = false) {
  const previousAccount = currentAccount;
  try {
    const response = await fetch('/api/auth/session', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not load your account.');
    currentAccount = result.account || null;
    csrfToken = result.csrfToken || null;
    accountLoadFailed = false;
  } catch (error) {
    console.error('Could not load the account session:', error);
    currentAccount = null;
    csrfToken = null;
    accountLoadFailed = true;
  }
  updateAccountArea();
  if (notify && (previousAccount?.id || null) !== (currentAccount?.id || null)) {
    dispatchAccountChange(currentAccount);
  }
  return currentAccount;
}

export const accountReady = loadSession();

export function getCurrentAccount() {
  return currentAccount;
}

export async function apiRequest(path, { method = 'GET', body, headers: requestHeaders, ...options } = {}) {
  const headers = new Headers(requestHeaders || {});
  headers.set('Accept', 'application/json');
  const request = { ...options, method, headers, credentials: 'same-origin' };
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
    request.body = JSON.stringify(body);
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  const response = await fetch(path, request);
  if (response.status === 204) {
    if (!response.ok) throw new Error('The server could not complete the request.');
    return null;
  }
  const contentType = response.headers.get('content-type') || '';
  let result;
  if (contentType.includes('application/json')) {
    result = await response.json();
  } else {
    throw new Error('The server returned an unexpected response.');
  }
  if (!response.ok) {
    const error = new Error(result.error || `Request failed (${response.status}).`);
    if (response.status === 401 && currentAccount) {
      currentAccount = null;
      csrfToken = null;
      updateAccountArea();
      dispatchAccountChange(null);
    }
    throw error;
  }
  return result;
}

function openDialog(mode) {
  const dialog = $('#accountDialog');
  if (!dialog) return;
  $('#registrationPanel').hidden = mode !== 'register';
  $('#loginPanel').hidden = mode !== 'login';
  $('#registrationSuccess').hidden = true;
  $('#registerForm').hidden = false;
  setAccountStatus('');
  setAccountStatus('', false, '#loginStatus');
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('account-dialog-open');
  requestAnimationFrame(() => {
    const focusTarget = mode === 'login' ? $('#loginUserId') : $('#fullName');
    focusTarget?.focus();
  });
}

function closeDialog(dismissed = false) {
  const dialog = $('#accountDialog');
  if (dialog?.open) dialog.close();
  document.body.classList.remove('account-dialog-open');
  if (dismissed) {
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch (error) {
      console.error('Could not remember the registration prompt dismissal:', error);
    }
  }
}

function mountDialog() {
  if ($('#accountDialog')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'accountDialog';
  dialog.className = 'account-dialog';
  dialog.setAttribute('aria-labelledby', 'accountDialogTitle');
  dialog.innerHTML = `
    <button class="dialog-close" type="button" aria-label="Close registration" data-close>×</button>
    <div class="dialog-content">
      <section id="registrationPanel">
        <p class="eyebrow">Your profile</p>
        <h2 id="accountDialogTitle">Create your account</h2>
        <p class="card-intro">Create an account to keep your trip plans and check-ins private to your profile.</p>
        <form id="registerForm" class="account-form">
          <label class="field field-wide" for="fullName">Full name
            <input id="fullName" name="fullName" maxlength="80" autocomplete="name" required />
          </label>
          <label class="field field-wide" for="address">Address
            <textarea id="address" name="address" maxlength="240" autocomplete="street-address" required></textarea>
          </label>
          <label class="field" for="mobile">Mobile number
            <input id="mobile" name="mobile" type="tel" maxlength="24" autocomplete="tel" required />
          </label>
          <label class="field" for="age">Age
            <input id="age" name="age" type="number" min="1" max="120" inputmode="numeric" required />
          </label>
          <label class="field" for="gender">Gender
            <select id="gender" name="gender" required>
              <option value="">Select</option>
              <option>Woman</option>
              <option>Man</option>
              <option>Non-binary</option>
              <option>Self-describe</option>
              <option>Prefer not to say</option>
            </select>
          </label>
          <label class="field" for="role">Who you are
            <select id="role" name="role" required>
              <option value="">Select</option>
              <option>Student</option>
              <option>Traveler</option>
              <option>Business owner</option>
              <option>Employee</option>
              <option>Other</option>
            </select>
          </label>
          <label class="field" for="registerPassword">Password
            <input id="registerPassword" name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required />
          </label>
          <label class="field" for="confirmPassword">Confirm password
            <input id="confirmPassword" name="confirmPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required />
          </label>
          <p class="local-note field-wide">Your profile and trip details are encrypted on the server. Passwords are never stored in plain text. Choose a unique password.</p>
          <p class="status field-wide" id="accountStatus" role="status" aria-live="polite"></p>
          <div class="dialog-actions field-wide">
            <button class="button button-outline button-small" type="button" data-close>Not now</button>
            <button class="button button-primary button-small" type="submit">Create account</button>
          </div>
          <p class="dialog-switch field-wide">Already have an ID? <button type="button" data-show-login>Sign in</button></p>
        </form>
        <section id="registrationSuccess" class="registration-success" hidden>
          <p>Your generated user ID</p>
          <strong id="generatedUserId"></strong>
          <p>Save this ID to sign in again. Your password cannot be recovered.</p>
          <button class="button button-primary button-small" type="button" data-close>Continue</button>
        </section>
      </section>
      <section id="loginPanel" hidden>
        <p class="eyebrow">Welcome back</p>
        <h2>Sign in</h2>
        <p class="card-intro">Sign in with your generated user ID.</p>
        <form id="loginForm" class="account-form">
          <label class="field field-wide" for="loginUserId">User ID
            <input id="loginUserId" name="userId" maxlength="15" autocomplete="username" required />
          </label>
          <label class="field field-wide" for="loginPassword">Password
            <input id="loginPassword" name="password" type="password" minlength="12" maxlength="128" autocomplete="current-password" required />
          </label>
          <p class="status field-wide" id="loginStatus" role="status" aria-live="polite"></p>
          <div class="dialog-actions field-wide">
            <button class="button button-outline button-small" type="button" data-close>Not now</button>
            <button class="button button-primary button-small" type="submit">Sign in</button>
          </div>
          <p class="dialog-switch field-wide">New here? <button type="button" data-show-register>Create an account</button></p>
        </form>
      </section>
    </div>`;
  document.body.append(dialog);

  dialog.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-close')) closeDialog(true);
    if (button.hasAttribute('data-show-login')) openDialog('login');
    if (button.hasAttribute('data-show-register')) openDialog('register');
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDialog(true);
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(true);
  });

  $('#registerForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const password = String(data.get('password'));
    if (password !== data.get('confirmPassword')) {
      setAccountStatus('Passwords do not match.', true);
      $('#confirmPassword').focus();
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await accountReady;
      const result = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: {
          profile: {
            fullName: String(data.get('fullName')).trim(),
            address: String(data.get('address')).trim(),
            mobile: String(data.get('mobile')).trim(),
            age: Number(data.get('age')),
            gender: String(data.get('gender')),
            role: String(data.get('role'))
          },
          password
        }
      });
      currentAccount = result.account;
      csrfToken = result.csrfToken;
      accountLoadFailed = false;
      $('#generatedUserId').textContent = currentAccount.id;
      form.reset();
      $('#registerForm').hidden = true;
      $('#registrationSuccess').hidden = false;
      updateAccountArea();
      dispatchAccountChange(currentAccount, true);
    } catch (error) {
      console.error('Could not create the account:', error);
      setAccountStatus(error.message || 'Could not create the account. Try again.', true);
    } finally {
      submit.disabled = false;
    }
  });

  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await accountReady;
      const result = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: {
          userId: String(data.get('userId')).trim().toUpperCase(),
          password: String(data.get('password'))
        }
      });
      currentAccount = result.account;
      csrfToken = result.csrfToken;
      accountLoadFailed = false;
      form.reset();
      updateAccountArea();
      dispatchAccountChange(currentAccount);
      closeDialog();
    } catch (error) {
      console.error('Could not sign in:', error);
      setAccountStatus(error.message || 'Could not sign in. Try again.', true, '#loginStatus');
    } finally {
      submit.disabled = false;
    }
  });
}

function initializeAccountUi() {
  mountDialog();
  updateAccountArea();
  accountReady.then(() => {
    try {
      if (!getCurrentAccount() && !sessionStorage.getItem(DISMISSED_KEY)) {
        setTimeout(() => {
          if (!getCurrentAccount() && !sessionStorage.getItem(DISMISSED_KEY)) {
            openDialog('register');
          }
        }, 10000);
      }
    } catch (error) {
      console.error('Could not schedule the registration prompt:', error);
    }
  });
}

window.addEventListener('safar-account-change', updateAccountArea);
initializeAccountUi();
