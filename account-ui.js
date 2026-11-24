const ACCOUNT_STORAGE_KEY = 'safar-rakshak.accounts.v1';
const ACTIVE_ACCOUNT_KEY = 'safar-rakshak.active-account.v1';
const DISMISSED_KEY = 'safar-rakshak.registration-dismissed.v1';
const $ = (selector, root = document) => root.querySelector(selector);
let accountLoadFailed = false;

function readDatabase() {
  const stored = localStorage.getItem(ACCOUNT_STORAGE_KEY);
  if (!stored) return { accounts: [] };
  const database = JSON.parse(stored);
  if (!database || !Array.isArray(database.accounts)) {
    throw new Error('Saved account data has an invalid format.');
  }
  return database;
}

function setAccountStatus(message, isError = false, selector = '#accountStatus') {
  const status = $(selector);
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function accountProfile(account) {
  return { id: account.id, ...account.profile };
}

export function getCurrentAccount() {
  try {
    const activeId = sessionStorage.getItem(ACTIVE_ACCOUNT_KEY);
    if (!activeId) {
      accountLoadFailed = false;
      return null;
    }
    const account = readDatabase().accounts.find((item) => item.id === activeId);
    accountLoadFailed = false;
    return account ? accountProfile(account) : null;
  } catch (error) {
    accountLoadFailed = true;
    console.error('Could not load local account data:', error);
    return null;
  }
}

function encodeBytes(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function decodeBytes(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function hashPassword(password, salt) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Password protection is unavailable in this browser. Open the app on localhost or HTTPS.');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt,
    iterations: 210000,
    hash: 'SHA-256'
  }, key, 256);
  return new Uint8Array(bits);
}

function passwordsMatch(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function generateUserId(existingAccounts) {
  let id;
  do {
    const randomBytes = crypto.getRandomValues(new Uint8Array(5));
    id = `SR-${Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  } while (existingAccounts.some((account) => account.id === id));
  return id;
}

function dispatchAccountChange(account, created = false, firstAccount = false) {
  window.dispatchEvent(new CustomEvent('safar-account-change', {
    detail: { account, created, firstAccount }
  }));
}

function updateAccountArea() {
  const area = $('#accountArea');
  if (!area) return;
  area.replaceChildren();

  const account = getCurrentAccount();
  if (accountLoadFailed) {
    const message = document.createElement('span');
    message.className = 'status error';
    message.setAttribute('role', 'alert');
    message.textContent = 'Could not load account data. Check browser storage.';
    area.append(message);
    return;
  }
  if (account) {
    const label = document.createElement('span');
    label.className = 'account-label';
    label.textContent = `Signed in as ${account.fullName}`;
    const signOut = document.createElement('button');
    signOut.type = 'button';
    signOut.className = 'button button-outline button-small';
    signOut.textContent = 'Sign out';
    signOut.addEventListener('click', () => {
      sessionStorage.removeItem(ACTIVE_ACCOUNT_KEY);
      dispatchAccountChange(null);
    });
    area.append(label, signOut);
    return;
  }

  const signIn = document.createElement('button');
  signIn.type = 'button';
  signIn.className = 'button button-outline button-small';
  signIn.textContent = 'Register / sign in';
  signIn.addEventListener('click', () => openDialog('register'));
  area.append(signIn);
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
        <p class="card-intro">Create a local profile to keep trip plans and check-ins separate on this device.</p>
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
            <input id="registerPassword" name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required />
          </label>
          <label class="field" for="confirmPassword">Confirm password
            <input id="confirmPassword" name="confirmPassword" type="password" minlength="8" maxlength="128" autocomplete="new-password" required />
          </label>
          <p class="local-note field-wide">Prototype only: profile details stay in this browser and are not protected like a real online account. Use test details; don't reuse an important password.</p>
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
          <p>Save this ID to sign in again. Your password cannot be recovered in this browser-only prototype.</p>
          <button class="button button-primary button-small" type="button" data-close>Continue</button>
        </section>
      </section>
      <section id="loginPanel" hidden>
        <p class="eyebrow">Welcome back</p>
        <h2>Sign in</h2>
        <p class="card-intro">Sign in with the user ID generated on this browser.</p>
        <form id="loginForm" class="account-form">
          <label class="field field-wide" for="loginUserId">User ID
            <input id="loginUserId" name="userId" maxlength="13" autocomplete="username" required />
          </label>
          <label class="field field-wide" for="loginPassword">Password
            <input id="loginPassword" name="password" type="password" maxlength="128" autocomplete="current-password" required />
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
    const data = new FormData(form);
    const password = String(data.get('password'));
    const fullName = String(data.get('fullName')).trim();
    const address = String(data.get('address')).trim();
    const mobile = String(data.get('mobile')).trim();
    if (!fullName || !address) {
      setAccountStatus('Enter your full name and address.', true);
      return;
    }
    if (!/^[+()0-9\s.-]{7,24}$/.test(mobile)) {
      setAccountStatus('Enter a valid mobile number.', true);
      $('#mobile').focus();
      return;
    }
    if (password !== data.get('confirmPassword')) {
      setAccountStatus('Passwords do not match.', true);
      $('#confirmPassword').focus();
      return;
    }

    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const passwordHash = await hashPassword(password, salt);
      const database = readDatabase();
      const firstAccount = database.accounts.length === 0;
      const account = {
        id: generateUserId(database.accounts),
        profile: {
          fullName,
          address,
          mobile,
          age: Number(data.get('age')),
          gender: String(data.get('gender')),
          role: String(data.get('role'))
        },
        salt: encodeBytes(salt),
        passwordHash: encodeBytes(passwordHash)
      };
      database.accounts.push(account);
      localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(database));
      sessionStorage.setItem(ACTIVE_ACCOUNT_KEY, account.id);
      $('#generatedUserId').textContent = account.id;
      $('#registerForm').hidden = true;
      $('#registrationSuccess').hidden = false;
      dispatchAccountChange(accountProfile(account), true, firstAccount);
      updateAccountArea();
    } catch (error) {
      console.error('Could not create the local account:', error);
      setAccountStatus(error.message || 'Could not create the account. Check browser storage and try again.', true);
    }
  });

  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const userId = String(data.get('userId')).trim().toUpperCase();
    const password = String(data.get('password'));
    try {
      const account = readDatabase().accounts.find((item) => item.id === userId);
      if (!account) {
        setAccountStatus('User ID or password is incorrect.', true, '#loginStatus');
        return;
      }
      const candidate = await hashPassword(password, decodeBytes(account.salt));
      if (!passwordsMatch(candidate, decodeBytes(account.passwordHash))) {
        setAccountStatus('User ID or password is incorrect.', true, '#loginStatus');
        return;
      }
      sessionStorage.setItem(ACTIVE_ACCOUNT_KEY, account.id);
      dispatchAccountChange(accountProfile(account));
      updateAccountArea();
      closeDialog();
    } catch (error) {
      console.error('Could not sign in to the local account:', error);
      setAccountStatus(error.message || 'Could not sign in. Check browser storage and try again.', true);
    }
  });
}

function initializeAccountUi() {
  mountDialog();
  updateAccountArea();
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
}

window.addEventListener('safar-account-change', updateAccountArea);
initializeAccountUi();
