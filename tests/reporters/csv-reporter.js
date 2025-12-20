const path = require('path');
const {
  escapeCsvField,
  formatErrorMessage,
  generateCsvRow,
  writeCsvFile,
  getCsvHeader
} = require('./csv-writer');

/**
 * Custom Jest Reporter for CSV Output
 * Generates a CSV file with test results including test suite, name, status, duration, and error messages
 */
class CsvReporter {
  /**
   * Constructor
   * @param {Object} globalConfig - Jest global configuration
   * @param {Object} reporterOptions - Options passed to the reporter
   * @param {Object} reporterContext - Reporter context
   */
  constructor(globalConfig, reporterOptions, reporterContext) {
    this._globalConfig = globalConfig;
    this._options = reporterOptions || {};
    this._context = reporterContext;

    // Array to store test results
    this._testResults = [];

    // Output file path (can be overridden in options)
    this._outputPath = this._options.outputPath || 'test-results.csv';
  }

  /**
   * Called when the test run starts
   * Initialize CSV file with header
   */
  onRunStart(results, options) {
    // Clear previous results
    this._testResults = [];

    // Log that CSV generation has started
    console.log('\nCSV Reporter: Collecting test results...');
  }

  /**
   * Called after each test file completes
   * Collect test results from the test file
   *
   * @param {Object} test - Test context
   * @param {Object} testResult - Test results for this file
   * @param {Object} aggregatedResult - Aggregated results so far
   */
  onTestResult(test, testResult, aggregatedResult) {
    // Extract suite name from file path
    const testFilePath = testResult.testFilePath;
    const fileName = path.basename(testFilePath, '.test.js');

    // Convert filename to readable suite name
    // e.g., "auth.routes" -> "Auth Routes"
    const suiteName = fileName
      .split(/[.-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Process each test result in the file
    testResult.testResults.forEach(result => {
      // Build full test name from ancestor titles and test title
      const fullTestName = [...result.ancestorTitles, result.title].join(' > ');

      // Determine status
      let status = result.status; // 'passed', 'failed', 'skipped', 'pending', 'todo'

      // Normalize status values to simpler format
      if (status === 'passed') status = 'pass';
      if (status === 'failed') status = 'fail';
      if (status === 'skipped' || status === 'pending' || status === 'todo') status = 'skip';

      // Get duration (may be undefined for skipped tests)
      const duration = result.duration || 0;

      // Format error message if test failed
      const errorMessage = result.status === 'failed'
        ? formatErrorMessage(result.failureMessages)
        : '';

      // Store the result
      this._testResults.push({
        suiteName,
        testName: fullTestName,
        status,
        duration,
        errorMessage
      });
    });
  }

  /**
   * Called when all tests have completed
   * Write collected results to CSV file
   *
   * @param {Set} testContexts - Set of test contexts
   * @param {Object} results - Final aggregated results
   */
  onRunComplete(testContexts, results) {
    // Generate CSV rows
    const csvRows = [getCsvHeader()];

    this._testResults.forEach(result => {
      const row = generateCsvRow(
        result.suiteName,
        result.testName,
        result.status,
        result.duration,
        result.errorMessage
      );
      csvRows.push(row);
    });

    // Write to file
    const success = writeCsvFile(this._outputPath, csvRows);

    // Log result
    if (success) {
      console.log(`\nCSV Reporter: Test results written to ${this._outputPath}`);
      console.log(`  Total tests: ${this._testResults.length}`);
      console.log(`  Passed: ${this._testResults.filter(r => r.status === 'pass').length}`);
      console.log(`  Failed: ${this._testResults.filter(r => r.status === 'fail').length}`);
      console.log(`  Skipped: ${this._testResults.filter(r => r.status === 'skip').length}`);
    } else {
      console.error(`\nCSV Reporter: Failed to write CSV file to ${this._outputPath}`);
    }
  }
}

module.exports = CsvReporter;
