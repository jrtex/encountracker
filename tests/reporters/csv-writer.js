const fs = require('fs');
const path = require('path');

/**
 * Escape a field for CSV format
 * Handles commas, quotes, and newlines according to CSV RFC 4180
 *
 * @param {string} field - The field to escape
 * @returns {string} - The escaped field
 */
function escapeCsvField(field) {
  if (field === null || field === undefined) {
    return '';
  }

  const stringField = String(field);

  // Check if field needs escaping (contains comma, quote, or newline)
  const needsEscaping = stringField.includes(',') ||
                        stringField.includes('"') ||
                        stringField.includes('\n') ||
                        stringField.includes('\r');

  if (!needsEscaping) {
    return stringField;
  }

  // Escape double quotes by doubling them
  const escaped = stringField.replace(/"/g, '""');

  // Replace newlines with spaces to keep single-line format
  const singleLine = escaped.replace(/[\r\n]+/g, ' ');

  // Wrap in double quotes
  return `"${singleLine}"`;
}

/**
 * Format error message for CSV output
 * Removes stack traces and condenses whitespace
 *
 * @param {string|string[]} error - Error message(s) from Jest
 * @returns {string} - Formatted error message
 */
function formatErrorMessage(error) {
  if (!error) {
    return '';
  }

  // Handle array of error messages (Jest provides failureMessages as array)
  const errorText = Array.isArray(error) ? error.join('; ') : String(error);

  // Remove ANSI color codes
  const withoutColors = errorText.replace(/\u001b\[\d+m/g, '');

  // Split by lines and filter out stack trace lines
  const lines = withoutColors.split('\n');
  const meaningfulLines = lines.filter(line => {
    // Keep lines that don't look like stack traces
    return !line.trim().startsWith('at ') &&
           !line.trim().startsWith('Error:') &&
           line.trim().length > 0;
  });

  // Join and condense whitespace
  const condensed = meaningfulLines
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return condensed;
}

/**
 * Generate a CSV row from test result data
 *
 * @param {string} testSuite - Name of the test suite
 * @param {string} testName - Name of the test
 * @param {string} status - Test status (pass/fail/skip/pending)
 * @param {number} duration - Test duration in milliseconds
 * @param {string} errorMessage - Error message (if failed)
 * @returns {string} - CSV row
 */
function generateCsvRow(testSuite, testName, status, duration, errorMessage) {
  const fields = [
    escapeCsvField(testSuite),
    escapeCsvField(testName),
    escapeCsvField(status),
    escapeCsvField(duration || 0),
    escapeCsvField(errorMessage || '')
  ];

  return fields.join(',');
}

/**
 * Write CSV data to file
 * Creates directory if it doesn't exist
 *
 * @param {string} filePath - Path to output CSV file
 * @param {string[]} rows - Array of CSV rows (including header)
 * @returns {boolean} - Success status
 */
function writeCsvFile(filePath, rows) {
  try {
    // Ensure directory exists
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // Join rows with newlines and write to file
    const csvContent = rows.join('\n') + '\n';
    fs.writeFileSync(filePath, csvContent, 'utf8');

    return true;
  } catch (error) {
    console.error(`Failed to write CSV file: ${error.message}`);
    return false;
  }
}

/**
 * Get the header row for the CSV file
 *
 * @returns {string} - CSV header row
 */
function getCsvHeader() {
  return 'Test Suite,Test Name,Status,Duration (ms),Error Message';
}

module.exports = {
  escapeCsvField,
  formatErrorMessage,
  generateCsvRow,
  writeCsvFile,
  getCsvHeader
};
