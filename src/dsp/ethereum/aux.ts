import { Input } from 'zkwasm-toolchain'
import type { CLEYaml } from '../../types'
import { u32ListToUint8Array } from '../../common/utils'
import type { BlockPrep, EthereumDataPrep } from './blockprep'
import { MptInput } from './mpt_input'

export function genAuxParams(
  cleYaml: CLEYaml,
  dataPrep: EthereumDataPrep,
) {
  let mptInput = new Input()
  mptInput = fillMPTInput(mptInput, cleYaml, dataPrep)

  const auxParams = {
    mpt: {
      private_input: mptInput.getPrivateInputStr(),
      public_input: mptInput.getPublicInputStr(),
      context_input: mptInput.getContextInputStr(),
    },
    adaptor: genAdaptorParams(cleYaml, dataPrep),
    extra: genExtra(cleYaml, dataPrep),
  }
  return auxParams
}

function fillMPTInput(input: Input, _cleYaml: CLEYaml, dataPrep: EthereumDataPrep) {
  const mptIpt = new MptInput(dataPrep.blocknumberOrder.length)
  for (const blockNum of dataPrep.blocknumberOrder) {
    // console.log('block number:', blockNum)
    const blcokPrepData = dataPrep.blockPrepMap.get(blockNum)
    mptIpt.addBlock(blcokPrepData)
  }
  // console.log('ctx:', mptIpt.getCtx())
  // console.log('private input:', mptIpt.getPriIpt())
  input.append(mptIpt.getCtx(), 2)
  input.append(mptIpt.getPriIpt(), 0)

  // console.log("mpt pri input:", input.getPrivateInputStr())
  // console.log("mpt pub input:", input.getPublicInputStr())
  // console.log("mpt ctx input:", input.getContextInputStr())
  return input
}

function genAdaptorParams(_cleYaml: CLEYaml, dataPrep: EthereumDataPrep) {
  const adaptorParam = {
    checkpoint_blocknum: calcCheckpointBlocknum([4321]), // "0x1234"
    mpt_blocknums: dataPrep.blocknumberOrder, // ["blocknum1", "blocknum2", ...]
    mpt_stateroots: dataPrep.blocknumberOrder.map((bn: any) => { return (dataPrep.blockPrepMap.get(bn) as BlockPrep).stateRoot }), // ["0xstateroot1", "0xstateroot2", ...]
    // placeholder
    mpt_receiptroots: dataPrep.blocknumberOrder.map((bn: any) => { return (dataPrep.blockPrepMap.get(bn) as BlockPrep).receiptsRoot }),
    mpt_txroots: dataPrep.blocknumberOrder.map((bn: any) => { return (dataPrep.blockPrepMap.get(bn) as BlockPrep).transactionsRoot }),
    rlp_blockheader: dataPrep.blocknumberOrder.map(
      (bn: any) => { return isRecentBlock(bn, dataPrep.latestBlocknumber) ? (dataPrep.blockPrepMap.get(bn) as BlockPrep).rlpheader : '' }), // ['0xrecentblockheaderrlp', '' for bho blocknum]
  }
  return adaptorParam
}

function isRecentBlock(blocknum: number, latestBlocknumber: number) {
  return blocknum > latestBlocknumber - 200 // TODO: fine-tune this.
}

function calcCheckpointBlocknum(_blockNums: number[]) {
  // TODO: enable later
  return null
}

// Used in trigger / verify only
function genExtra(_cleYaml: CLEYaml, dataPrep: EthereumDataPrep): Uint8Array {
  // TODO: double check here
  const encode = (dict: { [key: string]: any }): Uint8Array => {
    const u8a = u32ListToUint8Array(dict.rct_blocknum, 32, true)
    return u8a
  }
  const verifyExtra = {
    rct_blocknum: dataPrep.blocknumberOrder.map(
      (bn: any) => { return isRecentBlock(bn, dataPrep.latestBlocknumber) ? (dataPrep.blockPrepMap.get(bn) as BlockPrep).number : null }), // ['0xrecentblockheaderrlp', '' for bho blocknum]
  }
  return encode(verifyExtra)
}
