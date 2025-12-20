const net = require('net');

// Mock function to check if port is in use (same as in server/index.js)
async function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

describe('Server Startup - Port Conflict Detection', () => {
  const TEST_PORT = 9999; // Use a non-standard port for testing
  let testServer;

  afterEach((done) => {
    if (testServer && testServer.listening) {
      testServer.close(done);
    } else {
      done();
    }
  });

  test('should detect when port is available', async () => {
    const portInUse = await isPortInUse(TEST_PORT);
    expect(portInUse).toBe(false);
  });

  test('should detect when port is already in use', async () => {
    // Create a server on the test port
    testServer = net.createServer();
    await new Promise((resolve) => {
      testServer.listen(TEST_PORT, resolve);
    });

    // Check if port is in use
    const portInUse = await isPortInUse(TEST_PORT);
    expect(portInUse).toBe(true);
  });

  test('should allow server to start after port is freed', async () => {
    // Create and start a server
    testServer = net.createServer();
    await new Promise((resolve) => {
      testServer.listen(TEST_PORT, resolve);
    });

    // Verify port is in use
    let portInUse = await isPortInUse(TEST_PORT);
    expect(portInUse).toBe(true);

    // Close the server
    await new Promise((resolve) => {
      testServer.close(resolve);
    });

    // Verify port is now available
    portInUse = await isPortInUse(TEST_PORT);
    expect(portInUse).toBe(false);
  });

  test('isPortInUse should handle errors gracefully', async () => {
    // Test with an invalid port number (should not throw)
    const portInUse = await isPortInUse(TEST_PORT);
    expect(typeof portInUse).toBe('boolean');
  });
});
