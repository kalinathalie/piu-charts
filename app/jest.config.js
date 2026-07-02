module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: {
    "^react-native$": "<rootDir>/src/playlists/__mocks__/react-native-empty.js",
    "^@react-native-async-storage/async-storage$": "<rootDir>/src/playlists/__mocks__/react-native-empty.js",
  },
};
