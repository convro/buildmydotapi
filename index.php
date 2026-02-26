<?php
session_start();

$API_BASE = 'http://79.137.72.48:5999';

// --- Helper: call API ---
function api_post(string $url, array $data): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode($data),
        CURLOPT_TIMEOUT        => 10,
    ]);
    $body   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $json = json_decode($body, true) ?? [];
    return ['status' => $status, 'data' => $json];
}

$error   = '';
$success = '';
$view    = $_GET['view'] ?? 'login'; // login | register

// --- Logout ---
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: index.php');
    exit;
}

// --- Handle Register ---
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $view === 'register') {
    $res = api_post("$API_BASE/api/auth/register", [
        'imie'     => trim($_POST['imie']     ?? ''),
        'nazwisko' => trim($_POST['nazwisko'] ?? ''),
        'username' => trim($_POST['username'] ?? ''),
        'email'    => trim($_POST['email']    ?? ''),
        'password' => $_POST['password']      ?? '',
    ]);

    if ($res['status'] === 201) {
        $success = 'Konto utworzone! Możesz się teraz zalogować.';
        $view = 'login';
    } else {
        $msg   = $res['data']['message'] ?? $res['data']['error'] ?? 'Błąd rejestracji.';
        $error = htmlspecialchars($msg);
    }
}

// --- Handle Login ---
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $view === 'login') {
    $res = api_post("$API_BASE/api/auth/login", [
        'emailOrUsername' => trim($_POST['emailOrUsername'] ?? ''),
        'password'        => $_POST['password'] ?? '',
    ]);

    if ($res['status'] === 200 && isset($res['data']['token'])) {
        $_SESSION['token'] = $res['data']['token'];
        $_SESSION['user']  = $res['data']['user'] ?? [];
        header('Location: index.php');
        exit;
    } else {
        $msg   = $res['data']['message'] ?? $res['data']['error'] ?? 'Nieprawidłowe dane logowania.';
        $error = htmlspecialchars($msg);
    }
}

$loggedIn = isset($_SESSION['token']);
$user     = $_SESSION['user'] ?? [];
?>
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= $loggedIn ? 'Dashboard' : ($view === 'register' ? 'Rejestracja' : 'Logowanie') ?></title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0f1117;
    color: #e2e8f0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card {
    background: #1a1d27;
    border: 1px solid #2d3148;
    border-radius: 12px;
    padding: 40px;
    width: 100%;
    max-width: 420px;
  }
  .logo {
    text-align: center;
    margin-bottom: 28px;
  }
  .logo h1 {
    font-size: 22px;
    font-weight: 700;
    color: #7c6df2;
  }
  .logo p { font-size: 13px; color: #64748b; margin-top: 4px; }

  .tabs {
    display: flex;
    gap: 4px;
    background: #0f1117;
    border-radius: 8px;
    padding: 4px;
    margin-bottom: 28px;
  }
  .tab {
    flex: 1;
    text-align: center;
    padding: 8px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    color: #64748b;
    transition: all 0.15s;
  }
  .tab.active {
    background: #7c6df2;
    color: #fff;
  }

  label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
  .field { margin-bottom: 16px; }
  input[type=text], input[type=email], input[type=password] {
    width: 100%;
    padding: 10px 14px;
    background: #0f1117;
    border: 1px solid #2d3148;
    border-radius: 8px;
    color: #e2e8f0;
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s;
  }
  input:focus { border-color: #7c6df2; }

  .row { display: flex; gap: 12px; }
  .row .field { flex: 1; }

  button[type=submit] {
    width: 100%;
    padding: 11px;
    background: #7c6df2;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 4px;
    transition: background 0.15s;
  }
  button[type=submit]:hover { background: #6b5de0; }

  .alert {
    padding: 12px 14px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 20px;
  }
  .alert-error   { background: #2d1b1b; border: 1px solid #7f1d1d; color: #fca5a5; }
  .alert-success { background: #1b2d1b; border: 1px solid #14532d; color: #86efac; }

  /* Dashboard */
  .dashboard { max-width: 500px; }
  .avatar {
    width: 64px; height: 64px;
    border-radius: 50%;
    background: linear-gradient(135deg, #7c6df2, #a78bfa);
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; font-weight: 700;
    margin: 0 auto 16px;
  }
  .welcome { text-align: center; margin-bottom: 28px; }
  .welcome h2 { font-size: 20px; font-weight: 600; }
  .welcome p  { color: #64748b; font-size: 13px; margin-top: 4px; }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 24px;
  }
  .info-box {
    background: #0f1117;
    border: 1px solid #2d3148;
    border-radius: 8px;
    padding: 14px;
  }
  .info-box .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
  .info-box .value { font-size: 14px; color: #e2e8f0; font-weight: 500; word-break: break-all; }

  .token-box {
    background: #0f1117;
    border: 1px solid #2d3148;
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 24px;
  }
  .token-box .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }
  .token-box code {
    font-size: 11px;
    color: #7c6df2;
    word-break: break-all;
    line-height: 1.6;
    display: block;
  }
  .logout-btn {
    display: block;
    width: 100%;
    padding: 11px;
    background: transparent;
    border: 1px solid #7f1d1d;
    border-radius: 8px;
    color: #fca5a5;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    text-align: center;
    text-decoration: none;
    transition: background 0.15s;
  }
  .logout-btn:hover { background: #2d1b1b; }
</style>
</head>
<body>
<?php if ($loggedIn): ?>

<!-- ===== DASHBOARD ===== -->
<div class="card dashboard">
  <div class="avatar">
    <?= strtoupper(mb_substr($user['imie'] ?? $user['username'] ?? 'U', 0, 1)) ?>
  </div>
  <div class="welcome">
    <h2>Cześć, <?= htmlspecialchars($user['imie'] ?? $user['username'] ?? 'Użytkowniku') ?>!</h2>
    <p>Jesteś zalogowany.</p>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="label">Imię</div>
      <div class="value"><?= htmlspecialchars($user['imie'] ?? '—') ?></div>
    </div>
    <div class="info-box">
      <div class="label">Nazwisko</div>
      <div class="value"><?= htmlspecialchars($user['nazwisko'] ?? '—') ?></div>
    </div>
    <div class="info-box">
      <div class="label">Username</div>
      <div class="value">@<?= htmlspecialchars($user['username'] ?? '—') ?></div>
    </div>
    <div class="info-box">
      <div class="label">Email</div>
      <div class="value"><?= htmlspecialchars($user['email'] ?? '—') ?></div>
    </div>
  </div>

  <div class="token-box">
    <div class="label">JWT Token</div>
    <code><?= htmlspecialchars(substr($_SESSION['token'], 0, 80)) ?>...</code>
  </div>

  <a href="?logout=1" class="logout-btn">Wyloguj się</a>
</div>

<?php else: ?>

<!-- ===== LOGIN / REGISTER ===== -->
<div class="card">
  <div class="logo">
    <h1>shop-api</h1>
    <p>Panel użytkownika</p>
  </div>

  <div class="tabs">
    <a class="tab <?= $view === 'login'    ? 'active' : '' ?>" href="?view=login">Logowanie</a>
    <a class="tab <?= $view === 'register' ? 'active' : '' ?>" href="?view=register">Rejestracja</a>
  </div>

  <?php if ($error):   ?><div class="alert alert-error"><?= $error ?></div><?php endif ?>
  <?php if ($success): ?><div class="alert alert-success"><?= htmlspecialchars($success) ?></div><?php endif ?>

  <?php if ($view === 'login'): ?>
  <!-- LOGIN -->
  <form method="POST" action="?view=login">
    <div class="field">
      <label>Email lub nazwa użytkownika</label>
      <input type="text" name="emailOrUsername" placeholder="jan@example.com" required autofocus
             value="<?= htmlspecialchars($_POST['emailOrUsername'] ?? '') ?>">
    </div>
    <div class="field">
      <label>Hasło</label>
      <input type="password" name="password" placeholder="••••••••" required>
    </div>
    <button type="submit">Zaloguj się</button>
  </form>

  <?php else: ?>
  <!-- REGISTER -->
  <form method="POST" action="?view=register">
    <div class="row">
      <div class="field">
        <label>Imię</label>
        <input type="text" name="imie" placeholder="Jan" required
               value="<?= htmlspecialchars($_POST['imie'] ?? '') ?>">
      </div>
      <div class="field">
        <label>Nazwisko</label>
        <input type="text" name="nazwisko" placeholder="Kowalski" required
               value="<?= htmlspecialchars($_POST['nazwisko'] ?? '') ?>">
      </div>
    </div>
    <div class="field">
      <label>Nazwa użytkownika</label>
      <input type="text" name="username" placeholder="jankow" required
             value="<?= htmlspecialchars($_POST['username'] ?? '') ?>">
    </div>
    <div class="field">
      <label>Email</label>
      <input type="email" name="email" placeholder="jan@example.com" required
             value="<?= htmlspecialchars($_POST['email'] ?? '') ?>">
    </div>
    <div class="field">
      <label>Hasło</label>
      <input type="password" name="password" placeholder="min. 8 znaków" required>
    </div>
    <button type="submit">Utwórz konto</button>
  </form>
  <?php endif ?>
</div>

<?php endif ?>
</body>
</html>
