import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Order "mo:core/Order";
import Array "mo:core/Array";
import Text "mo:core/Text";
import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";



actor {
  include MixinStorage();

  module SectionType {
    public func toText(section : SectionType) : Text {
      switch (section) {
        case (#TenderDetails) { "TenderDetails" };
        case (#LOI) { "LOI" };
        case (#RunningBill) { "RunningBill" };
        case (#SiteExpenses) { "SiteExpenses" };
        case (#MaterialExpenses) { "MaterialExpenses" };
      };
    };

    public func fromText(text : Text) : SectionType {
      switch (text) {
        case ("TenderDetails") { #TenderDetails };
        case ("LOI") { #LOI };
        case ("RunningBill") { #RunningBill };
        case ("SiteExpenses") { #SiteExpenses };
        case ("MaterialExpenses") { #MaterialExpenses };
        case (_) { Runtime.trap("Invalid SectionType text") };
      };
    };

    public func compare(a : SectionType, b : SectionType) : Order.Order {
      Text.compare(toText(a), toText(b));
    };
  };

  module FileRef {
    public func compare(file1 : FileRef, file2 : FileRef) : Order.Order {
      switch (Int.compare(file1.uploadedAt, file2.uploadedAt)) {
        case (#equal) { Text.compare(file1.fileId, file2.fileId) };
        case (order) { order };
      };
    };
  };

  module Sections {
    public func empty() : Sections {
      let sectionsMap = Map.empty<SectionType, [FileRef]>();
      sectionsMap.add(#TenderDetails, []);
      sectionsMap.add(#LOI, []);
      sectionsMap.add(#RunningBill, []);
      sectionsMap.add(#SiteExpenses, []);
      sectionsMap.add(#MaterialExpenses, []);
      sectionsMap;
    }
  };

  module Contract {
    public func compare(contract1 : Contract, contract2 : Contract) : Order.Order {
      Int.compare(contract1.id, contract2.id);
    };
  };

  public type FileRef = {
    fileId : Text;
    blob : Storage.ExternalBlob;
    filename : Text;
    fileType : Text;
    uploadedAt : Int;
  };

  public type SectionType = {
    #TenderDetails;
    #LOI;
    #RunningBill;
    #SiteExpenses;
    #MaterialExpenses;
  };

  public type Sections = Map.Map<SectionType, [FileRef]>;

  public type Contract = {
    id : Nat;
    name : Text;
    createdAt : Int;
    sections : Sections;
  };

  public type ContractResponse = {
    id : Nat;
    name : Text;
    createdAt : Int;
  };

  var nextContractId = 0;

  let contracts = Map.empty<Nat, Contract>();

  public shared ({ caller }) func createContract(name : Text) : async Nat {
    let contractId = nextContractId;
    nextContractId += 1;

    let newContract : Contract = {
      id = contractId;
      name;
      createdAt = Time.now();
      sections = Sections.empty();
    };

    contracts.add(contractId, newContract);
    contractId;
  };

  public query ({ caller }) func getAllContracts() : async [ContractResponse] {
    contracts.values().toArray().map(
      func(contract) {
        {
          id = contract.id;
          name = contract.name;
          createdAt = contract.createdAt;
        };
      }
    ).sort(
      func(a, b) {
        Int.compare(b.createdAt, a.createdAt);
      }
    );
  };

  public query ({ caller }) func getContract(id : Nat) : async ContractResponse {
    switch (contracts.get(id)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?contract) {
        {
          id = contract.id;
          name = contract.name;
          createdAt = contract.createdAt;
        };
      };
    };
  };

  public shared ({ caller }) func deleteContract(id : Nat) : async () {
    if (contracts.containsKey(id)) {
      contracts.remove(id);
    } else {
      Runtime.trap("Contract not found for deletion");
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
    switch (contracts.get(contractId)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?contract) {
        let newFile : FileRef = {
          fileId;
          blob;
          filename;
          fileType;
          uploadedAt = Time.now();
        };

        let files = switch (contract.sections.get(section)) {
          case (null) { [newFile] };
          case (?existingFiles) { existingFiles.concat([newFile]) };
        };

        contract.sections.add(section, files);

        let updatedContract : Contract = {
          id = contract.id;
          name = contract.name;
          createdAt = contract.createdAt;
          sections = contract.sections;
        };

        contracts.add(contractId, updatedContract);
      };
    };
  };

  public query ({ caller }) func getSectionFiles(
    contractId : Nat,
    section : SectionType,
  ) : async [FileRef] {
    switch (contracts.get(contractId)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?contract) {
        switch (contract.sections.get(section)) {
          case (null) { [] };
          case (?files) { files };
        };
      };
    };
  };

  public shared ({ caller }) func removeFileFromSection(
    contractId : Nat,
    section : SectionType,
    fileId : Text,
  ) : async () {
    switch (contracts.get(contractId)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?contract) {
        switch (contract.sections.get(section)) {
          case (null) {
            Runtime.trap("Section not found in contract");
          };
          case (?files) {
            let filteredFiles = files.filter(
              func(file) { file.fileId != fileId }
            );

            contract.sections.add(section, filteredFiles);

            let updatedContract : Contract = {
              id = contract.id;
              name = contract.name;
              createdAt = contract.createdAt;
              sections = contract.sections;
            };

            contracts.add(contractId, updatedContract);
          };
        };
      };
    };
  };
};
