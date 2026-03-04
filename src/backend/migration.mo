import Storage "blob-storage/Storage";

module {
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

  type Actor = {
    nextContractId : Nat;
    contractsArray : [Contract];
  };

  public func run(old : Actor) : Actor {
    old;
  };
};
