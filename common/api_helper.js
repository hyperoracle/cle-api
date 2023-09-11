import { TxReceipt } from "./tx_receipt.js";
import { providers } from "ethers";
import { getRawReceipts } from "./ethers_helper.js";
import { trimPrefix, fromHexString } from "./utils.js";
import { loadZKGraphSources } from "./config_utils.js";
import { logReceiptAndEvents } from "./log_utils.js";
import assert from "assert";


function eventTo7Offsets(event, receiptBaseOffset) {
  let rst = [event.address_offset[0] + receiptBaseOffset];

  for (let i = 0; i < 4; i++) {
    rst.push(
      i < event.topics.length
        ? event.topics_offset[i][0] + receiptBaseOffset
        : 0,
    );
  }

  rst.push(event.data_offset[0] + receiptBaseOffset);
  rst.push(event.data.length);
  return rst;
}

function cleanReceipt(r) {
  return trimPrefix(trimPrefix(r, "0x"), "02");
}

export function rlpDecodeAndEventFilter(rawreceiptList, srcAddrList, srcEsigsList) {
  const filteredRawReceiptList = [];
  const filteredEventsList = [];

  for (let i in rawreceiptList) {
    const es = TxReceipt.fromRawStr(rawreceiptList[i]).filter(
      srcAddrList,
      srcEsigsList,
    );
    if (es.length > 0) {
      filteredRawReceiptList.push(rawreceiptList[i]);
      filteredEventsList.push(es);
    }
  }
  return [filteredRawReceiptList, filteredEventsList];
}

export function genStreamAndMatchedEventOffsets(rawreceiptList, eventList) {
  let matched_offset_list = [];
  let accumulateReceiptLength = 0;
  let rawreceipts = "";

  assert(rawreceiptList.length == eventList.length);

  for (let rcpid in rawreceiptList) {
    const es = eventList[rcpid];
    matched_offset_list = matched_offset_list.concat(
      ...es.map((e) => eventTo7Offsets(e, accumulateReceiptLength)),
    );

    var r = cleanReceipt(rawreceiptList[rcpid]);
    rawreceipts += r;

    accumulateReceiptLength += Math.ceil(r.length / 2);
  }

  return [fromHexString(rawreceipts), matched_offset_list];
}

// Format inputs with length and input value
export function formatIntInput(input) {
  return `0x${input.toString(16)}:i64 `;
}

// Format bytes input
export function formatHexStringInput(input) {
  return `0x${trimPrefix(input, "0x")}:bytes-packed `;
}

// Format inputs with length and input value
export function formatVarLenInput(input) {
  //   var formatted = "";
  //   inputs.map((input) => {
  //     var inp = trimPrefix(input, '0x')
  //     formatted += `${formatIntInput(Math.ceil(inp.length / 2))}${formatHexStringInput(inp)}`;
  //   });

  var inp = trimPrefix(input, "0x");
  var formatted = `${formatIntInput(
    Math.ceil(inp.length / 2),
  )}${formatHexStringInput(inp)}`;
  return formatted;
}

export async function filterEvents(yamlPath, rawreceiptList, enableLog){
    // Load config
    const [sourceAddressList, sourceEsigsList] = loadZKGraphSources(yamlPath);

    if (enableLog) {
        // if (sourceAddressList.length <= 1) {
        //     console.log("[*] Source address", sourceAddressList);
        //     console.log("[*] Source events signatures:", sourceEsigsList, "\n");
        // } else {
            console.log("[*] Data Sources:");
            for (let i = 0; i < sourceAddressList.length; i++){
                console.log("    ("+i+") Address:", sourceAddressList[i], '\n        Event Sigs:', sourceEsigsList[i], "\n");
            }
        // }
    }

    // RLP Decode and Filter
    const [filteredRawReceiptList, filteredEventList] = rlpDecodeAndEventFilter(
      rawreceiptList,
      sourceAddressList.map((addr) => fromHexString(addr)),
      sourceEsigsList.map((esigList) => esigList.map((esig) => fromHexString(esig))),
    );

    // Gen Offsets
    let [rawReceipts, matchedEventOffsets] = genStreamAndMatchedEventOffsets(
      filteredRawReceiptList,
      filteredEventList,
    );

    if (enableLog){
        // Log
        logReceiptAndEvents(
          rawreceiptList,
          matchedEventOffsets,
          filteredEventList,
        );
    }

    // may remove
    matchedEventOffsets = Uint32Array.from(matchedEventOffsets);

    return [rawReceipts, matchedEventOffsets]
}