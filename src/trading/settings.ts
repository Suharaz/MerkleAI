export const maSettings: { [key: string]: number[] } = {
    '5m': [10, 20],
    '15m': [10, 20],
    '30m': [10, 20],
    '1h': [50],
    '4h': [50],
    '1d': [200],
  };
  
  export const rsiSettings: { [key: string]: number } = {
    '5m': 9,
    '15m': 9,
    '30m': 9,
    '1h': 14,
    '4h': 14,
    '1d': 21,
  };
  
  export const macdSettings: { [key: string]: [number, number, number] } = {
    '5m': [5, 13, 1],
    '15m': [5, 13, 1],
    '30m': [5, 13, 1],
    '1h': [12, 26, 9],
    '4h': [12, 26, 9],
    '1d': [21, 55, 8],
  };
  
  export const bollingerSettings: { [key: string]: [number, number] } = {
    '5m': [20, 2],
    '15m': [20, 2],
    '30m': [20, 2],
    '1h': [20, 2],
    '4h': [20, 2],
    '1d': [20, 2],
  };
  
  export const stochasticSettings: { [key: string]: [number, number] } = {
    '5m': [5, 3],
    '15m': [5,3],
    '30m': [5, 3],
    '1h': [14, 3],
    '4h': [14, 3],
    '1d': [21, 5],
  };
  
  export const atrSettings: { [key: string]: number } = {
    '5m': 14,
    '15m': 14,
    '30m': 14,
    '1h': 14,
    '4h': 14,
    '1d': 14,
  };