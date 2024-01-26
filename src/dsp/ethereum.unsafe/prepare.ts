import type { providers } from 'ethers'
import { ethers } from 'ethers'
import { RLP } from '@ethereumjs/rlp'
import {
  getBlockWithTxs,
  getProof,
  getRawReceipts,
} from '../../common/ethers_helper'
import { safeHex, uint8ArrayToHex } from '../../common/utils'
import { BlockPrep } from '../ethereum/blockprep'

export async function unsafePrepareOneBlock(provider: providers.JsonRpcProvider, blockNumber: number, stateDSAddrList: any[], stateDSSlotsList: any[][], needRLPReceiptList: boolean, needTransactions: boolean) {
  // let [stateDSAddrList, stateDSSlotsList] = [stateDSAddrList, stateDSSlotsList]
  const block = new BlockPrep(
    blockNumber,
    // header rlp
    '0x00',
  )

  /**
   * prepare storage data
   */

  for (let i = 0; i < stateDSAddrList.length; i++) {
    // request
    const ethproof = await getProof(
      provider,
      stateDSAddrList[i],
      stateDSSlotsList[i],
      ethers.utils.hexValue(blockNumber),
    )

    if (ethproof.balance === '0x0')
      ethproof.balance = ''

    if (ethproof.nonce === '0x0')
      ethproof.nonce = ''

    const nestedList = [
      Buffer.from(safeHex(ethproof.nonce), 'hex'),
      Buffer.from(safeHex(ethproof.balance), 'hex'),
      Buffer.from(safeHex(ethproof.storageHash), 'hex'),
      Buffer.from(safeHex(ethproof.codeHash), 'hex'),
    ]

    const accountRLP = uint8ArrayToHex(RLP.encode(nestedList))

    block.addFromGetProofResult(ethproof, accountRLP)
  }

  /**
   * prepare raw receipts data
   */
  if (needRLPReceiptList) {
    const rawreceiptList = await getRawReceipts(provider, blockNumber).catch(
      (error) => {
        throw error
      },
    )

    block.addRLPReceipts(rawreceiptList)
  }

  if (needTransactions) {
    const blockwithtxs = await getBlockWithTxs(provider, blockNumber)
    block.setTransactions(blockwithtxs.transactions)
  }

  return block
}
