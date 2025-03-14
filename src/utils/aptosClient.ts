import { MerkleClient, MerkleClientConfig } from "@merkletrade/ts-sdk";
import { Aptos } from "@aptos-labs/ts-sdk";

class AptosSingleton {
    private static merkleInstance: MerkleClient;
    private static aptosInstance: Aptos;

    static async getMerkleClient(): Promise<MerkleClient> {
        if (!this.merkleInstance) {
            this.merkleInstance = new MerkleClient(await MerkleClientConfig.mainnet());
        }
        return this.merkleInstance;
    }

    static async getAptosClient(): Promise<Aptos> {
        if (!this.aptosInstance) {
            const merkle = await this.getMerkleClient();
            this.aptosInstance = new Aptos(merkle.config.aptosConfig);
        }
        return this.aptosInstance;
    }
}

export default AptosSingleton;
