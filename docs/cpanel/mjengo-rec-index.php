<?php
// Mjengo recordings store. Lives at public_html/mjengo-rec/index.php on the cPanel host (served at https://cashcade.co.ke/mjengo-rec/index.php).
// The shared secret is read from /home3/cashcade/.mjengo-rec-secret (outside the web root), the same value as
// RECORDINGS_SECRET in the app. Every request carries exp (unix seconds) and sig = hmac_sha256(secret, "<action>|<name>|<exp>").
$origins = ['https://app.sautisalama.org', 'https://sautisalama.org', 'https://www.sautisalama.org', 'http://localhost:3000'];
$o = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($o, $origins, true)) { header("Access-Control-Allow-Origin: $o"); header('Vary: Origin'); }
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

$secretFile = '/home3/cashcade/.mjengo-rec-secret';
$secret = is_file($secretFile) ? trim(file_get_contents($secretFile)) : '';
function fail($c, $m) { http_response_code($c); header('Content-Type: application/json'); echo json_encode(['error' => $m]); exit; }
if ($secret === '') fail(503, 'not configured');

$action = $_GET['a'] ?? '';
$name = preg_replace('/[^a-zA-Z0-9._-]/', '', $_GET['f'] ?? '');
$exp = (int)($_GET['exp'] ?? 0);
$sig = $_GET['sig'] ?? '';
if ($name === '' || strpos($name, '..') !== false || $exp < time()) fail(403, 'expired');
if (!hash_equals(hash_hmac('sha256', "$action|$name|$exp", $secret), $sig)) fail(403, 'bad signature');

$dir = __DIR__ . '/files';
if (!is_dir($dir)) { mkdir($dir, 0750, true); }
$path = "$dir/$name";

if ($action === 'put') {
  // Raw body, appended at ?offset so a long recording can be sent in pieces.
  $offset = (int)($_GET['offset'] ?? 0);
  if ($offset === 0 && is_file($path)) unlink($path);
  if ($offset > 0 && (!is_file($path) || filesize($path) !== $offset)) fail(409, 'offset mismatch');
  $in = fopen('php://input', 'rb'); $out = fopen($path, 'ab');
  $n = stream_copy_to_stream($in, $out);
  fclose($in); fclose($out);
  header('Content-Type: application/json');
  echo json_encode(['ok' => true, 'size' => filesize($path), 'wrote' => $n]);
  exit;
}
if ($action === 'get') {
  if (!is_file($path)) fail(404, 'missing');
  $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
  header('Content-Type: ' . ($ext === 'mp4' ? 'video/mp4' : ($ext === 'ogg' ? 'audio/ogg' : 'video/webm')));
  header('Content-Length: ' . filesize($path));
  header('Accept-Ranges: none');
  readfile($path);
  exit;
}
fail(400, 'unknown action');
