# MerkleAI

## Description
Merkle AI Auto Trading is a project that provides an automated trading system based on AI Agents, it allows users to create their own AI Agents to trade automatically on Merkle.trade via Telegram. Users can configure their own AI Agent with options such as trading token, trading strategy and time frame.

## Project Structure
- **src/bot**: Contains the bot's core functionalities including callbacks, commands, and keyboards.
- **src/database**: Manages data storage, currently using Firebase.
- **src/logs**: For logging purposes.
- **src/schedule**: Handles job scheduling and execution.
- **src/trading**: Core trading logic including strategy execution, market data handling, and indicator calculations.
- **src/types**: TypeScript type definitions.
- **src/utils**: Utility functions for various operations.

## Installation
To install the project, run:
```bash
npm install
```

## Usage
To run the bot, use:
```bash
npm start
```

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
[MIT](https://choosealicense.com/licenses/mit/)
