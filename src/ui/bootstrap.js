// Keep startup failures visible even if a dependency cannot be loaded.
try {
  await import('./app.js');
} catch (error) {
  console.error('工作台启动失败', error);
  window.smokeError = String(error?.message ?? error);
  document.getElementById('status-text').textContent = '启动失败，请重新打开程序';
  const message = document.querySelector('#browser .empty p');
  if (message) message.textContent = '页面初始化失败。请重新打开程序；如果仍然出现，请反馈下方错误。';
  const details = document.createElement('p'); details.className = 'hint'; details.textContent = window.smokeError;
  document.querySelector('#browser')?.append(details);
}
