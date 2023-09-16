import yaml from "js-yaml";
import fs from "fs";
import semver from "semver";
import { ethers } from "ethers";

export function loadYaml(fname) {
  try {
    // Read the YAML file contents
    const fileContents = fs.readFileSync(fname, "utf8");
    // Parse the YAML content
    return yaml.load(fileContents);
  } catch (error) {
    console.error(error);
  }
}

export function yamlhealthCheck(config) {
  // 1. specVersion check

  if (!config.specVersion || typeof config.specVersion !== 'string' || config.specVersion.trim() === '') {
    throw new Error("specVersion is missing or empty");
  }

  if (semver.gt(config.specVersion, '0.0.1')) {
    throw new Error("Invalid specVersion, it should be <= 0.0.1");
  }

  // 3. datasources can have multiple objects, but should not be empty
  if (!config.dataSources || config.dataSources.length === 0) {
    throw new Error("dataSources should not be empty");
  }

  const sourceNetworks = [];

  config.dataSources.forEach(dataSource => {
    // 4. every object in datasources MUST have network, source, mapping
    if (!dataSource.network || !dataSource.source || !dataSource.mapping) {
      throw new Error("dataSource object is missing required fields");
    }

    sourceNetworks.push(dataSource.network);

    // 5. all fields must be not empty
    if (!dataSource.kind || !dataSource.source.address || !dataSource.mapping.kind ||
        !dataSource.mapping.apiVersion || !dataSource.mapping.language || !dataSource.mapping.file) {
      throw new Error("Some required fields are empty in dataSource");
    }

    // 2. apiVersion → zkgraph-lib version check
    if (!dataSource.mapping.apiVersion || typeof dataSource.mapping.apiVersion !== 'string' || dataSource.mapping.apiVersion.trim() === '') {
      throw new Error("apiVersion is missing or empty in one of the dataSources");
    }

    if (semver.gt(dataSource.mapping.apiVersion, '0.0.1')) {
      throw new Error("Invalid apiVersion, it should be <= 0.0.1");
    }

    // 7. source must contain address
    if (!dataSource.source.address) {
      throw new Error("Address field is missing in dataSource source");
    }

    // 8. eventHandlers can have multiple event objects, but should not be empty
    if (!dataSource.mapping.eventHandlers || dataSource.mapping.eventHandlers.length === 0) {
      throw new Error("eventHandlers should not be empty");
    }

    dataSource.mapping.eventHandlers.forEach(eventHandler => {
      // 9. each event object must have event field and handler field
      if (!eventHandler.event || !eventHandler.handler) {
        throw new Error("eventHandler object is missing required fields");
      }

      // 10. handler doesn't need to be checked, not empty is enough
      if (!eventHandler.handler) {
        throw new Error("Handler field in eventHandler is empty");
      }
    });
  });

  // 6. every network field must be the same
  if (new Set(sourceNetworks).size !== 1) {
    throw new Error("All dataSource networks must be the same");
  }

  // 11. data destination must have network and destination
  if (config.dataDestinations) {
    if (!config.dataDestinations[0].network || !config.dataDestinations[0].destination) {
      throw new Error("dataDestinations object is missing required fields");
    }

    // 13. address must be the ethereum address and not address zero
    if (!isEthereumAddress(config.dataDestinations[0].destination.address)) {
      throw new Error("Invalid Ethereum address in dataDestinations");
    }
  }

  // 12. the network must be same as the source network
  // TODO: right now we don't check the block hash, so skip the same network check
  // if (config.dataDestinations[0].network !== sourceNetworks[0]) {
  //   throw new Error("dataDestinations network must match dataSources network");
  // }
}

export function isEthereumAddress(address) {
  try {
    const parsedAddress = ethers.utils.getAddress(address);
    return parsedAddress !== '0x0000000000000000000000000000000000000000';
  } catch (error) {
    return false;
  }
}


export function loadZKGraphSources(fname) {
  const config = loadYaml(fname);
  yamlhealthCheck(config);
//   const source_address = config.dataSources[0].source.address;

  let loadFromDataSource = (dataSource) => {
    const source_address = dataSource.source.address;
    const edefs = dataSource.mapping.eventHandlers.map(
        (eh) => eh.event,
      );
      const source_esigs = edefs.map((ed) =>
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(ed)),
      );
      return [source_address, source_esigs];
  }

//   const edefs = config.dataSources[0].mapping.eventHandlers.map(
//     (eh) => eh.event,
//   );
//   const source_esigs = edefs.map((ed) =>
//     ethers.utils.keccak256(ethers.utils.toUtf8Bytes(ed)),
//   );
  const sourceAddressList=[];
  const sourceEsigsList=[];
  config.dataSources.map((ds) => {let [sa, se] = loadFromDataSource(ds); sourceAddressList.push(sa); sourceEsigsList.push(se)})
//   console.log('sourceAddressList', sourceAddressList)
//   console.log('sourceEsigsList', sourceEsigsList)
  return [sourceAddressList, sourceEsigsList];
}
// loadZKGraphConfig('tests/testsrc/zkgraph.yaml')

export function loadZKGraphName(fname) {
  const config = loadYaml(fname);
  return config.name;
}

export function applyZKGraphConfig(configObj) {} //placeholder

export function loadZKGraphDestinations(fname) {
  const config = loadYaml(fname);
  return config.dataDestinations;
  // [
  //   {
  //     kind: 'ethereum/contract',
  //     network: 'mainnet',
  //     destination: { address: '0x123abc' }
  //   }
  // ]
}
