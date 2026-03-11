import Array "mo:core/Array";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Time "mo:core/Time";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";

actor {
  include MixinStorage();

  type SectionType = {
    #TenderDetails;
    #LOI;
    #RunningBill;
    #SiteExpenses;
  };

  type FileRef = {
    fileId : Text;
    blob : Storage.ExternalBlob;
    filename : Text;
    fileType : Text;
    uploadedAt : Int;
  };

  type SectionEntry = {
    sectionType : SectionType;
    files : [FileRef];
    notes : Text;
  };

  type Contract = {
    id : Nat;
    name : Text;
    status : Text;
    contractValue : ?Nat;
    alreadyExpended : ?Nat;
    createdAt : Int;
    sections : [SectionEntry];
  };

  type ContractResponse = {
    id : Nat;
    name : Text;
    status : Text;
    contractValue : ?Nat;
    alreadyExpended : ?Nat;
    createdAt : Int;
  };

  type ManualEntryRecord = {
    key : Text;
    headers : [Text];
    rows : [[Text]];
  };

  var nextContractId = 0;
  var contracts : [Contract] = [];
  var manualEntries : [ManualEntryRecord] = [];

  func sectionKey(contractId : Nat, sectionType : SectionType) : Text {
    let sectionName = switch (sectionType) {
      case (#TenderDetails) { "TenderDetails" };
      case (#LOI) { "LOI" };
      case (#RunningBill) { "RunningBill" };
      case (#SiteExpenses) { "SiteExpenses" };
    };
    contractId.toText() # ":" # sectionName;
  };

  func findContractIndex(id : Nat) : ?Nat {
    var i = 0;
    for (contract in contracts.values()) {
      if (contract.id == id) {
        return ?i;
      };
      i += 1;
    };
    null;
  };

  func findSectionIndex(sections : [SectionEntry], sectionType : SectionType) : ?Nat {
    var i = 0;
    for (section in sections.values()) {
      if (section.sectionType == sectionType) {
        return ?i;
      };
      i += 1;
    };
    null;
  };

  func createEmptySection(sectionType : SectionType) : SectionEntry {
    {
      sectionType;
      files = [];
      notes = "";
    };
  };

  func createAllSections() : [SectionEntry] {
    [
      createEmptySection(#TenderDetails),
      createEmptySection(#LOI),
      createEmptySection(#RunningBill),
      createEmptySection(#SiteExpenses),
    ];
  };

  func compareContractResponses(a : ContractResponse, b : ContractResponse) : Order.Order {
    Int.compare(b.createdAt, a.createdAt);
  };

  func createContractInternal(name : Text, status : Text, contractValue : ?Nat, alreadyExpended : ?Nat) : Nat {
    let contractId = nextContractId;
    nextContractId += 1;

    let newContract : Contract = {
      id = contractId;
      name;
      status;
      contractValue;
      alreadyExpended;
      createdAt = Time.now();
      sections = createAllSections();
    };

    contracts := contracts.concat([newContract]);
    contractId;
  };

  public shared ({ caller }) func createContract(name : Text, status : Text, contractValue : ?Nat, alreadyExpended : ?Nat) : async Nat {
    createContractInternal(name, status, contractValue, alreadyExpended);
  };

  public shared ({ caller }) func seedWithContracts(seedCount : Nat) : async () {
    var i = 0;
    while (i < seedCount) {
      let statusText = if (i % 2 == 0) { "Active" } else { "Completed" };
      let value = if (i % 3 == 0) { ?(i * 1000) } else { null };
      let _ = createContractInternal("Seed Contract " # i.toText(), statusText, value, null);
      i += 1;
    };
  };

  public query ({ caller }) func getAllContracts() : async [ContractResponse] {
    let contractResponses = contracts.map(
      func(contract) {
        {
          id = contract.id;
          name = contract.name;
          status = contract.status;
          contractValue = contract.contractValue;
          alreadyExpended = contract.alreadyExpended;
          createdAt = contract.createdAt;
        };
      },
    );
    contractResponses.sort(compareContractResponses);
  };

  public query ({ caller }) func getContract(id : Nat) : async ContractResponse {
    switch (findContractIndex(id)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?idx) {
        let c = contracts[idx];
        {
          id = c.id;
          name = c.name;
          status = c.status;
          contractValue = c.contractValue;
          alreadyExpended = c.alreadyExpended;
          createdAt = c.createdAt;
        };
      };
    };
  };

  public shared ({ caller }) func deleteContract(id : Nat) : async () {
    switch (findContractIndex(id)) {
      case (null) { Runtime.trap("Contract not found for deletion") };
      case (?_idx) {
        contracts := contracts.filter<Contract>(
          func(c) { c.id != id },
        );
      };
    };
  };

  public shared ({ caller }) func updateContract(id : Nat, name : Text, status : Text, contractValue : ?Nat, alreadyExpended : ?Nat) : async () {
    switch (findContractIndex(id)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?index) {
        let existingContract = contracts[index];
        let updatedContract : Contract = {
          id = existingContract.id;
          name;
          status;
          contractValue;
          alreadyExpended;
          createdAt = existingContract.createdAt;
          sections = existingContract.sections;
        };

        contracts := Array.tabulate<Contract>(
          contracts.size(),
          func(i) {
            if (i == index) {
              updatedContract;
            } else {
              contracts[i];
            };
          },
        );
      };
    };
  };

  public shared ({ caller }) func addFileToSection(
    contractId : Nat,
    section : SectionType,
    fileId : Text,
    blob : Storage.ExternalBlob,
    filename : Text,
    fileType : Text,
  ) : async () {
    switch (findContractIndex(contractId)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?contractIndex) {
        let contract = contracts[contractIndex];

        switch (findSectionIndex(contract.sections, section)) {
          case (null) { Runtime.trap("Section not found") };
          case (?sectionIndex) {
            let newFile : FileRef = {
              fileId;
              blob;
              filename;
              fileType;
              uploadedAt = Time.now();
            };

            let updatedSections = Array.tabulate(
              contract.sections.size(),
              func(i) {
                if (i == sectionIndex) {
                  {
                    sectionType = section;
                    files = contract.sections[i].files.concat([newFile]);
                    notes = contract.sections[i].notes;
                  };
                } else { contract.sections[i] };
              },
            );

            let updatedContract : Contract = {
              id = contract.id;
              name = contract.name;
              status = contract.status;
              contractValue = contract.contractValue;
              alreadyExpended = contract.alreadyExpended;
              createdAt = contract.createdAt;
              sections = updatedSections;
            };

            contracts := Array.tabulate<Contract>(
              contracts.size(),
              func(i) {
                if (i == contractIndex) { updatedContract } else { contracts[i] };
              },
            );
          };
        };
      };
    };
  };

  public query ({ caller }) func getSectionFiles(
    contractId : Nat,
    section : SectionType,
  ) : async { files : [FileRef]; notes : Text } {
    switch (findContractIndex(contractId)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?contractIndex) {
        let contract = contracts[contractIndex];

        switch (findSectionIndex(contract.sections, section)) {
          case (null) { Runtime.trap("Section not found") };
          case (?sectionIndex) {
            let s = contract.sections[sectionIndex];
            {
              files = s.files;
              notes = s.notes;
            };
          };
        };
      };
    };
  };

  public shared ({ caller }) func removeFileFromSection(
    contractId : Nat,
    section : SectionType,
    fileId : Text,
  ) : async () {
    switch (findContractIndex(contractId)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?contractIndex) {
        let contract = contracts[contractIndex];

        switch (findSectionIndex(contract.sections, section)) {
          case (null) { Runtime.trap("Section not found") };
          case (?sectionIndex) {
            let filteredFiles = contract.sections[sectionIndex].files.filter(
              func(f) { f.fileId != fileId },
            );

            let updatedSections = Array.tabulate(
              contract.sections.size(),
              func(i) {
                if (i == sectionIndex) {
                  {
                    sectionType = section;
                    files = filteredFiles;
                    notes = contract.sections[i].notes;
                  };
                } else { contract.sections[i] };
              },
            );

            let updatedContract : Contract = {
              id = contract.id;
              name = contract.name;
              status = contract.status;
              contractValue = contract.contractValue;
              alreadyExpended = contract.alreadyExpended;
              createdAt = contract.createdAt;
              sections = updatedSections;
            };

            contracts := Array.tabulate<Contract>(
              contracts.size(),
              func(i) {
                if (i == contractIndex) { updatedContract } else { contracts[i] };
              },
            );
          };
        };
      };
    };
  };

  public shared ({ caller }) func updateSectionNotes(
    contractId : Nat,
    section : SectionType,
    notes : Text,
  ) : async () {
    switch (findContractIndex(contractId)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?contractIndex) {
        let contract = contracts[contractIndex];

        switch (findSectionIndex(contract.sections, section)) {
          case (null) { Runtime.trap("Section not found") };
          case (?sectionIndex) {
            let updatedSections = Array.tabulate(
              contract.sections.size(),
              func(i) {
                if (i == sectionIndex) {
                  {
                    sectionType = section;
                    files = contract.sections[i].files;
                    notes;
                  };
                } else { contract.sections[i] };
              },
            );

            let updatedContract : Contract = {
              id = contract.id;
              name = contract.name;
              status = contract.status;
              contractValue = contract.contractValue;
              alreadyExpended = contract.alreadyExpended;
              createdAt = contract.createdAt;
              sections = updatedSections;
            };

            contracts := Array.tabulate<Contract>(
              contracts.size(),
              func(i) {
                if (i == contractIndex) { updatedContract } else { contracts[i] };
              },
            );
          };
        };
      };
    };
  };

  public query ({ caller }) func getContractFileCounts(id : Nat) : async [(Text, Nat)] {
    switch (findContractIndex(id)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?contractIndex) {
        contracts[contractIndex].sections.map(
          func(section) {
            let sectionLabel = switch (section.sectionType) {
              case (#TenderDetails) { "Tender Details" };
              case (#LOI) { "LOI" };
              case (#RunningBill) { "Running Bill" };
              case (#SiteExpenses) { "Site Expenses" };
            };
            (sectionLabel, section.files.size());
          }
        );
      };
    };
  };

  public query ({ caller }) func queryContractsCompatible() : async [Contract] {
    contracts;
  };

  public query ({ caller }) func getManualEntry(
    contractId : Nat,
    section : SectionType,
  ) : async ?{ headers : [Text]; rows : [[Text]] } {
    let k = sectionKey(contractId, section);
    var i = 0;
    for (entry in manualEntries.values()) {
      if (entry.key == k) {
        return ?{ headers = entry.headers; rows = entry.rows };
      };
      i += 1;
    };
    null;
  };

  public shared ({ caller }) func saveManualEntry(
    contractId : Nat,
    section : SectionType,
    headers : [Text],
    rows : [[Text]],
  ) : async () {
    let k = sectionKey(contractId, section);
    var found = false;
    var idx = 0;
    for (entry in manualEntries.values()) {
      if (entry.key == k) {
        found := true;
      };
      if (not found) {
        idx += 1;
      };
    };
    if (found) {
      manualEntries := Array.tabulate<ManualEntryRecord>(
        manualEntries.size(),
        func(i) {
          if (i == idx) {
            { key = k; headers; rows };
          } else {
            manualEntries[i];
          };
        },
      );
    } else {
      manualEntries := manualEntries.concat([{ key = k; headers; rows }]);
    };
  };
};
