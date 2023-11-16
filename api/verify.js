import {
  waitTaskStatus,
} from "../requests/zkwasm_taskdetails.js";
import {zkwasm_imagedetails} from "../requests/zkwasm_imagedetails.js";
import {
  getTargetNetwork,
  parseArgs
} from "../common/utils.js";
import { ZkWasmUtil } from "@hyperoracle/zkwasm-service-helper";
import Web3EthContract from "web3-eth-contract";
import { globalVerifierContract, verifier_abi } from "../common/constants.js";
import { ProveTaskNotReady as ProofNotFound } from "../common/error.js";

/**
 * Verify zk proof onchain.
 * @param {string} yamlContent
 * @param {string} proveTaskId
 * @param {string} ZkwasmProviderUrl
 * @param {boolean} enableLog
 * @returns {boolean} - true if verification success, false otherwise.
 */
export async function verify(
  zkGraphExecutable,
  proveTaskId,
  ZkwasmProviderUrl
) {
  const { zkgraphYaml } = zkGraphExecutable;

  const networkName = zkgraphYaml.dataDestinations[0].network;
  const targetNetwork = getTargetNetwork(networkName);

  // Check task status of prove.
  const taskDetails = await waitTaskStatus(ZkwasmProviderUrl, proveTaskId, ["Done", "Fail"], 3000, 0).catch((err) => {
    throw err;
  })

   //TODO: timeout
  if (taskDetails.status !== "Done") {
    throw new ProofNotFound("Prove task is not 'Done', can't verify")
  }

  // TODO: read proof from local file rather than the zkwasm server

  // Get deployed verification contract address.
  const verifierContractAddress= globalVerifierContract;

  // Inputs for verification
  const proof = ZkWasmUtil.bytesToBigIntArray(taskDetails.proof);
  const instances = ZkWasmUtil.bytesToBigIntArray(taskDetails.batch_instances);
  const aux = ZkWasmUtil.bytesToBigIntArray(taskDetails.aux);
  const arg = ZkWasmUtil.bytesToBigIntArray(taskDetails.instances);

  if (targetNetwork.value === 5) {
    Web3EthContract.setProvider("https://rpc.ankr.com/eth_goerli");
  }
  if (targetNetwork.value === 11155111) {
    Web3EthContract.setProvider("https://rpc2.sepolia.org");
  }
  let contract = new Web3EthContract(verifier_abi.abi, verifierContractAddress);

  let verificationResult = true;
  // verify success if no err throw
  await contract.methods
    .verify(proof, instances, aux, [arg])
    .call()
    .catch((err) => {
      if (err.message.startsWith('Returned error: execution reverted')) {
        verificationResult = false;
      } else {
        throw err;
      }
    });

  return verificationResult;
}
