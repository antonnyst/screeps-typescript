export interface Manager {
  maxSpeed: number;
  minSpeed: number;
  run(speed: number): void;
}
