import { ZkWasmUtil } from '@ora-io/zkwasm-service-helper'
import type { Nullable } from '@murongg/utils'
import type { Input } from 'zkwasm-toolchain'
import { toHexStringBytes32Reverse } from '../common/utils'
import { ora_prove } from '../requests/ora_prove'
import {
  waitTaskStatus,
} from '../requests/zkwasm_taskdetails'
import type { CLEExecutable } from '../types/api'
import { logger } from '../common'
import type { SingableProver } from './setup'

export type ProveOptions = SingableProver
/**
 * Submit prove task to a given zkwasm and return the proof details.
 * @param {object} cleExecutable
 * @param {Input} input
 * @param {string} options
 * @returns {object} - proof task details in json
 */
export async function prove(
  cleExecutable: Omit<CLEExecutable, 'cleYaml'>,
  input: Input,
  options: ProveOptions,
) {
  const result: {
    md5: Nullable<string>
    taskId: Nullable<string>
  } = {
    md5: null,
    taskId: null,
  }
  const { wasmUint8Array } = cleExecutable

  const md5 = ZkWasmUtil.convertToMd5(wasmUint8Array).toUpperCase()

  result.md5 = md5

  await ora_prove(
    md5,
    input,
    options,
  ).then(async (response) => {
    result.taskId = response.data.result.id
    logger.log(`[+] PROVING TASK STARTED. TASK ID: ${result.taskId}`, '\n')
  })
    .catch((error) => {
    // TODO: other error types need to be handle here? e.g. NoSetup
      throw error
    })

  // const privateInputArray = input.getPrivateInputStr().trim().split(' ')
  // const publicInputArray = input.getPublicInputStr().trim().split(' ')
  // const [response, isSetUpSuccess, errorMessage] = await zkwasm_prove(
  //   zkwasmProverUrl,
  //   userPrivateKey,
  //   md5,
  //   publicInputArray,
  //   privateInputArray,
  // ).catch((error) => {
  //   throw error
  // })

  logger?.log(`[*] IMAGE MD5: ${md5}`, '\n')
  return result
}

export async function waitProve(
  proverUrl: string,
  taskId: string,
) {
  const result: {
    instances: Nullable<string>
    batch_instances: Nullable<string>
    proof: Nullable<string>
    aux: Nullable<string>
    md5: Nullable<string>
    taskId: Nullable<string>
    status: Nullable<string>
    taskDetails: Nullable<any>
  } = {
    instances: null,
    batch_instances: null,
    proof: null,
    aux: null,
    md5: null,
    taskId: null,
    status: '',
    taskDetails: null,
  }

  const taskDetails = await waitTaskStatus(
    proverUrl,
    taskId,
    ['Done', 'Fail', 'DryRunFailed'],
    3000,
    0,
  ).catch((err) => {
    throw err
  }) // TODO: timeout

  if (taskDetails.status === 'Done') {
    const instances = toHexStringBytes32Reverse(taskDetails.instances)
    const batch_instances = toHexStringBytes32Reverse(
      taskDetails.batch_instances,
    )
    const proof = toHexStringBytes32Reverse(taskDetails.proof)
    const aux = toHexStringBytes32Reverse(taskDetails.aux)
    result.instances = instances
    result.batch_instances = batch_instances
    result.proof = proof
    result.aux = aux
    result.taskId = taskId
    result.status = taskDetails.status
  }
  else {
    result.taskId = taskId
  }

  result.taskDetails = taskDetails
  return result
}
