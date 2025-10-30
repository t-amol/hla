const path = require("path");

module.exports = {
  mode: "development",
  entry: "./src/index.tsx",
  devtool: "inline-source-map",
  devServer: {
    static: ["./dist", "./"],     // also serve project root so index.html works
    port: process.env.FRONTEND_PORT || 5173,
    proxy: { "/api": "http://localhost:8000" },
    host: "0.0.0.0"
  },
  module: {
    rules: [
      { test: /\.tsx?$/, use: "ts-loader", exclude: /node_modules/ },
      { test: /\.css$/, use: ["style-loader", "css-loader"] }
    ]
  },
  resolve: { extensions: [".tsx", ".ts", ".js"] },
  output: { filename: "bundle.js", path: path.resolve(__dirname, "dist"), clean: true }
};
