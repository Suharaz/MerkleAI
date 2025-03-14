import winston from "winston";
import fs from "fs";
import path from "path";

const logDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: "DD-MM-YYYY HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message }) => {
        return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    })
);

const logger = winston.createLogger({
    level: "info",
    format: logFormat,
    transports: [
        new winston.transports.File({ filename: path.join(logDir, "error.log"), level: "error" }),  
        new winston.transports.File({ filename: path.join(logDir, "combined.log") })
    ],
});

export default logger;
