declare module "dmn-js/lib/Modeler" {
  interface DmnModelerOptions {
    container: HTMLElement;
    keyboard?: { bindTo?: Window };
  }

  interface DmnImportResult {
    warnings: unknown[];
  }

  interface DmnSaveResult {
    xml: string;
  }

  export default class DmnModeler {
    constructor(options: DmnModelerOptions);
    importXML(xml: string): Promise<DmnImportResult>;
    saveXML(opts?: { format?: boolean }): Promise<DmnSaveResult>;
    destroy(): void;
    getActiveViewer(): unknown;
  }
}
