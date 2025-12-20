const { exec } = require('child_process');
const PORT = process.env.PORT || 3000;

console.log(`🔍 Searching for processes using port ${PORT}...`);

// Windows-specific command to find and kill process on port
const isWindows = process.platform === 'win32';

if (isWindows) {
  // Find PID using the port
  exec(`netstat -ano | findstr :${PORT}`, (err, stdout) => {
    if (err || !stdout) {
      console.log(`✅ No processes found using port ${PORT}`);
      return;
    }

    // Extract PIDs from netstat output
    const lines = stdout.split('\n');
    const pids = new Set();

    lines.forEach(line => {
      const match = line.match(/LISTENING\s+(\d+)/);
      if (match) {
        pids.add(match[1]);
      }
    });

    if (pids.size === 0) {
      console.log(`✅ No processes found using port ${PORT}`);
      return;
    }

    console.log(`Found ${pids.size} process(es) using port ${PORT}`);

    // Kill each process
    pids.forEach(pid => {
      exec(`taskkill /PID ${pid} /F`, (killErr) => {
        if (killErr) {
          console.error(`❌ Failed to kill process ${pid}`);
        } else {
          console.log(`✅ Killed process ${pid}`);
        }
      });
    });
  });
} else {
  // Unix/Linux/Mac command
  exec(`lsof -ti:${PORT} | xargs kill -9`, (err) => {
    if (err) {
      console.log(`✅ No processes found using port ${PORT}`);
    } else {
      console.log(`✅ Killed all processes using port ${PORT}`);
    }
  });
}
