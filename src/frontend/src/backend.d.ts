import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export interface ContractResponse {
    id: bigint;
    status: string;
    name: string;
    createdAt: bigint;
    contractValue?: bigint;
}
export interface SectionEntry {
    files: Array<FileRef>;
    sectionType: SectionType;
    notes: string;
}
export interface Contract {
    id: bigint;
    status: string;
    name: string;
    createdAt: bigint;
    sections: Array<SectionEntry>;
    contractValue?: bigint;
}
export interface FileRef {
    blob: ExternalBlob;
    fileType: string;
    filename: string;
    fileId: string;
    uploadedAt: bigint;
}
export enum SectionType {
    LOI = "LOI",
    MaterialExpenses = "MaterialExpenses",
    TenderDetails = "TenderDetails",
    SiteExpenses = "SiteExpenses",
    RunningBill = "RunningBill"
}
export interface backendInterface {
    addFileToSection(contractId: bigint, section: SectionType, fileId: string, blob: ExternalBlob, filename: string, fileType: string): Promise<void>;
    createContract(name: string, status: string, contractValue: bigint | null): Promise<bigint>;
    deleteContract(id: bigint): Promise<void>;
    getAllContracts(): Promise<Array<ContractResponse>>;
    getContract(id: bigint): Promise<ContractResponse>;
    getContractFileCounts(id: bigint): Promise<Array<[string, bigint]>>;
    getManualEntry(contractId: bigint, section: SectionType): Promise<{
        rows: Array<Array<string>>;
        headers: Array<string>;
    } | null>;
    getSectionFiles(contractId: bigint, section: SectionType): Promise<{
        files: Array<FileRef>;
        notes: string;
    }>;
    queryContractsCompatible(): Promise<Array<Contract>>;
    removeFileFromSection(contractId: bigint, section: SectionType, fileId: string): Promise<void>;
    saveManualEntry(contractId: bigint, section: SectionType, headers: Array<string>, rows: Array<Array<string>>): Promise<void>;
    seedWithContracts(seedCount: bigint): Promise<void>;
    updateContract(id: bigint, name: string, status: string, contractValue: bigint | null): Promise<void>;
    updateSectionNotes(contractId: bigint, section: SectionType, notes: string): Promise<void>;
}
