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
    #MaterialExpenses;
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
    status : Text; // "Active" | "Completed" | "On Hold"
    contractValue : ?Nat;
    createdAt : Int;
    sections : [SectionEntry];
  };

  type ContractResponse = {
    id : Nat;
    name : Text;
    status : Text;
    contractValue : ?Nat;
    createdAt : Int;
  };

  var nextContractId = 0;
  var contracts : [Contract] = [];

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
      createEmptySection(#MaterialExpenses),
    ];
  };

  public shared ({ caller }) func createContract(name : Text, status : Text, contractValue : ?Nat) : async Nat {
    let contractId = nextContractId;
    nextContractId += 1;

    let newContract : Contract = {
      id = contractId;
      name;
      status;
      contractValue;
      createdAt = Time.now();
      sections = createAllSections();
    };

    contracts := contracts.concat([newContract]);
    contractId;
  };

  module ContractResponse {
    public func compare(a : ContractResponse, b : ContractResponse) : Order.Order {
      Int.compare(b.createdAt, a.createdAt);
    };
  };

  public query ({ caller }) func getAllContracts() : async [ContractResponse] {
    contracts.map(
      func(contract) {
        {
          id = contract.id;
          name = contract.name;
          status = contract.status;
          contractValue = contract.contractValue;
          createdAt = contract.createdAt;
        };
      }
    ).sort();
  };

  public query ({ caller }) func getContract(id : Nat) : async ContractResponse {
    let contract = contracts.find(func(c) { c.id == id });
    switch (contract) {
      case (null) { Runtime.trap("Contract not found") };
      case (?c) {
        {
          id = c.id;
          name = c.name;
          status = c.status;
          contractValue = c.contractValue;
          createdAt = c.createdAt;
        };
      };
    };
  };

  public shared ({ caller }) func deleteContract(id : Nat) : async () {
    let initialSize = contracts.size();
    contracts := contracts.filter(
      func(c) { c.id != id }
    );
    if (contracts.size() == initialSize) {
      Runtime.trap("Contract not found for deletion");
    };
  };

  public shared ({ caller }) func updateContract(id : Nat, name : Text, status : Text, contractValue : ?Nat) : async () {
    let contractIndex = contracts.findIndex(
      func(c) { c.id == id }
    );

    switch (contractIndex) {
      case (null) { Runtime.trap("Contract not found") };
      case (?index) {
        let existingContract = contracts[index];
        let updatedContract : Contract = {
          id = existingContract.id;
          name;
          status;
          contractValue;
          createdAt = existingContract.createdAt;
          sections = existingContract.sections;
        };

        contracts := Array.tabulate<Contract>(
          contracts.size(),
          func(i) {
            if (i == index) { updatedContract } else { contracts[i] };
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
    let contractIndex = contracts.findIndex(
      func(c) { c.id == contractId }
    );

    switch (contractIndex) {
      case (null) { Runtime.trap("Contract not found") };
      case (?index) {
        let contract = contracts[index];
        let sectionIndex = contract.sections.findIndex(
          func(s) { s.sectionType == section }
        );

        switch (sectionIndex) {
          case (null) { Runtime.trap("Section not found") };
          case (?secIndex) {
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
                if (i == secIndex) {
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
              createdAt = contract.createdAt;
              sections = updatedSections;
            };

            contracts := Array.tabulate<Contract>(
              contracts.size(),
              func(i) {
                if (i == index) { updatedContract } else { contracts[i] };
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
    let contract = contracts.find(func(c) { c.id == contractId });
    switch (contract) {
      case (null) { Runtime.trap("Contract not found") };
      case (?c) {
        let sectionEntry = c.sections.find(
          func(s) { s.sectionType == section }
        );
        switch (sectionEntry) {
          case (null) { Runtime.trap("Section not found") };
          case (?s) {
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
    let contractIndex = contracts.findIndex(
      func(c) { c.id == contractId }
    );

    switch (contractIndex) {
      case (null) { Runtime.trap("Contract not found") };
      case (?index) {
        let contract = contracts[index];
        let sectionIndex = contract.sections.findIndex(
          func(s) { s.sectionType == section }
        );

        switch (sectionIndex) {
          case (null) { Runtime.trap("Section not found") };
          case (?secIndex) {
            let updatedSections = Array.tabulate(
              contract.sections.size(),
              func(i) {
                if (i == secIndex) {
                  {
                    sectionType = section;
                    files = contract.sections[i].files.filter(
                      func(f) { f.fileId != fileId }
                    );
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
              createdAt = contract.createdAt;
              sections = updatedSections;
            };

            contracts := Array.tabulate<Contract>(
              contracts.size(),
              func(i) {
                if (i == index) { updatedContract } else { contracts[i] };
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
    let contractIndex = contracts.findIndex(
      func(c) { c.id == contractId }
    );

    switch (contractIndex) {
      case (null) { Runtime.trap("Contract not found") };
      case (?index) {
        let contract = contracts[index];
        let sectionIndex = contract.sections.findIndex(
          func(s) { s.sectionType == section }
        );

        switch (sectionIndex) {
          case (null) { Runtime.trap("Section not found") };
          case (?secIndex) {
            let updatedSections = Array.tabulate(
              contract.sections.size(),
              func(i) {
                if (i == secIndex) {
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
              createdAt = contract.createdAt;
              sections = updatedSections;
            };

            contracts := Array.tabulate<Contract>(
              contracts.size(),
              func(i) {
                if (i == index) { updatedContract } else { contracts[i] };
              },
            );
          };
        };
      };
    };
  };

  public query ({ caller }) func getContractFileCounts(id : Nat) : async [(Text, Nat)] {
    let contract = contracts.find(func(c) { c.id == id });
    switch (contract) {
      case (null) { Runtime.trap("Contract not found") };
      case (?c) {
        c.sections.map(
          func(section) {
            let sectionLabel = switch (section.sectionType) {
              case (#TenderDetails) { "Tender Details" };
              case (#LOI) { "LOI" };
              case (#RunningBill) { "Running Bill" };
              case (#SiteExpenses) { "Site Expenses" };
              case (#MaterialExpenses) { "Material Expenses" };
            };
            (sectionLabel, section.files.size());
          }
        );
      };
    };
  };
};
