/** Content contract passed to the simulation by app composition. Values are authored in content/. */
export interface BalanceDefinition {
  readonly manualOutputPerAction: number;
}

export interface Catalog {
  readonly balance: BalanceDefinition;
}
