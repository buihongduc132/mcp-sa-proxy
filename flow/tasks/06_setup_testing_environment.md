# Task 6: Set Up Testing Environment

## Goal

Configure the project for testing using Jest and add necessary testing utilities.

## Steps

1.  **Install Jest and related dependencies**:
    ```bash
    npm install --save-dev jest ts-jest @types/jest
    ```

2.  **Create Jest Configuration**:
    - Create a `jest.config.js` file in the root of the project.
    - Configure it to use `ts-jest`, set up the test environment for Node.js, and define the test file matching pattern.

3.  **Add Test Script**:
    - Add a `"test": "jest"` script to the `scripts` section of `package.json`.