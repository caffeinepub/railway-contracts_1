import Int "mo:core/Int";
import Order "mo:core/Order";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Runtime "mo:core/Runtime";
import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";
import Migration "migration";

(with migration = Migration.run)
actor {
  include MixinStorage();

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

  public type SectionEntry = {
    section : SectionType;
    files : [FileRef];
  };

  public type Contract = {
    id : Nat;
    name : Text;
    createdAt : Int;
    sections : [SectionEntry];
  };

  public type ContractResponse = {
    id : Nat;
    name : Text;
    createdAt : Int;
  };

  var nextContractId = 0;
  var contractsArray : [Contract] = [];

  func sectionEq(a : SectionType, b : SectionType) : Bool {
    switch (a, b) {
      case (#TenderDetails, #TenderDetails) { true };
      case (#LOI, #LOI) { true };
      case (#RunningBill, #RunningBill) { true };
      case (#SiteExpenses, #SiteExpenses) { true };
      case (#MaterialExpenses, #MaterialExpenses) { true };
      case _ { false };
    };
  };

  func defaultSections() : [SectionEntry] {
    [
      { section = #TenderDetails; files = [] },
      { section = #LOI; files = [] },
      { section = #RunningBill; files = [] },
      { section = #SiteExpenses; files = [] },
      { section = #MaterialExpenses; files = [] },
    ];
  };

  func findContract(id : Nat) : ?Contract {
    contractsArray.find(func(c : Contract) : Bool { c.id == id });
  };

  func replaceContract(updated : Contract) {
    let filtered = contractsArray.filter(func(c : Contract) : Bool { c.id != updated.id });
    contractsArray := filtered.concat([updated]);
  };

  public shared ({ caller }) func createContract(name : Text) : async Nat {
    let contractId = nextContractId;
    nextContractId += 1;

    let newContract : Contract = {
      id = contractId;
      name;
      createdAt = Time.now();
      sections = defaultSections();
    };

    contractsArray := contractsArray.concat([newContract]);
    contractId;
  };

  public query ({ caller }) func getAllContracts() : async [ContractResponse] {
    let mapped : [ContractResponse] = contractsArray.map(
      func(c : Contract) : ContractResponse {
        {
          id = c.id;
          name = c.name;
          createdAt = c.createdAt;
        };
      }
    );
    mapped.sort(func(a : ContractResponse, b : ContractResponse) : Order.Order {
      Int.compare(b.createdAt, a.createdAt)
    });
  };

  public query ({ caller }) func getContract(id : Nat) : async ContractResponse {
    switch (findContract(id)) {
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
    let filtered = contractsArray.filter(func(c : Contract) : Bool { c.id != id });
    if (filtered.size() == contractsArray.size()) {
      Runtime.trap("Contract not found for deletion");
    } else {
      contractsArray := filtered;
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
    switch (findContract(contractId)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?cv) {
        let newFile : FileRef = {
          fileId;
          blob;
          filename;
          fileType;
          uploadedAt = Time.now();
        };

        let updatedSections : [SectionEntry] = cv.sections.map(
          func(se : SectionEntry) : SectionEntry {
            if (sectionEq(se.section, section)) {
              { se with files = se.files.concat([newFile]) };
            } else {
              se;
            };
          }
        );

        let updatedContract : Contract = {
          id = cv.id;
          name = cv.name;
          createdAt = cv.createdAt;
          sections = updatedSections;
        };

        replaceContract(updatedContract);
      };
    };
  };

  public query ({ caller }) func getSectionFiles(
    contractId : Nat,
    section : SectionType,
  ) : async [FileRef] {
    switch (findContract(contractId)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?cv) {
        switch (cv.sections.find(func(se : SectionEntry) : Bool { sectionEq(se.section, section) })) {
          case (null) { [] };
          case (?se) { se.files };
        };
      };
    };
  };

  public shared ({ caller }) func removeFileFromSection(
    contractId : Nat,
    section : SectionType,
    fileId : Text,
  ) : async () {
    switch (findContract(contractId)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?cv) {
        let newSections : [SectionEntry] = cv.sections.map(
          func(se : SectionEntry) : SectionEntry {
            if (sectionEq(se.section, section)) {
              let newFiles = se.files.filter(func(f : FileRef) : Bool { f.fileId != fileId });
              { se with files = newFiles };
            } else {
              se;
            };
          }
        );

        let updatedContract : Contract = {
          id = cv.id;
          name = cv.name;
          createdAt = cv.createdAt;
          sections = newSections;
        };

        replaceContract(updatedContract);
      };
    };
  };
};
