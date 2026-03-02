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
    name: string;
    createdAt: bigint;
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
    createContract(name: string): Promise<bigint>;
    deleteContract(id: bigint): Promise<void>;
    getAllContracts(): Promise<Array<ContractResponse>>;
    getContract(id: bigint): Promise<ContractResponse>;
    getSectionFiles(contractId: bigint, section: SectionType): Promise<Array<FileRef>>;
    removeFileFromSection(contractId: bigint, section: SectionType, fileId: string): Promise<void>;
}
