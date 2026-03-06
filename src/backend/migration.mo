import Array "mo:core/Array";

module {
  // Old types (pre-migration)
  type OldContract = {
    id : Nat;
    name : Text;
    status : Text;
    contractValue : ?Nat;
    createdAt : Int;
    sections : [SectionEntry];
  };

  // Other unchanged types from old actor
  type SectionEntry = {
    sectionType : SectionType;
    files : [FileRef];
    notes : Text;
  };

  type SectionType = {
    #TenderDetails;
    #LOI;
    #RunningBill;
    #SiteExpenses;
    #MaterialExpenses;
  };

  type FileRef = {
    fileId : Text;
    blob : Blob;
    filename : Text;
    fileType : Text;
    uploadedAt : Int;
  };

  type ManualEntryRecord = {
    key : Text;
    headers : [Text];
    rows : [[Text]];
  };

  // Old actor type
  type OldActor = {
    nextContractId : Nat;
    contracts : [OldContract];
    manualEntries : [ManualEntryRecord];
  };

  // New types (post-migration)
  type NewContract = {
    id : Nat;
    name : Text;
    status : Text;
    contractValue : ?Nat;
    alreadyExpended : ?Nat;
    createdAt : Int;
    sections : [SectionEntry];
  };

  // New actor type
  type NewActor = {
    nextContractId : Nat;
    contracts : [NewContract];
    manualEntries : [ManualEntryRecord];
  };

  // Run migration: Transform old contracts to new contracts with alreadyExpended field
  public func run(old : OldActor) : NewActor {
    let newContracts = old.contracts.map<OldContract, NewContract>(
      func(oldContract) {
        { oldContract with alreadyExpended = null };
      }
    );
    { old with contracts = newContracts };
  };
};
