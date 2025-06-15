import { Disposable, languages, TextDocument, DocumentSelector } from 'vscode';
import { CompletionProvider } from './completionProvider';
import { Schema } from '../common';
import { FormattingProvider } from './formatter';

export default class LanguageServer implements Disposable {
    private subscriptions: Disposable[];
    private schemaProvider?: (doc: TextDocument) => Thenable<Schema|void>;

    constructor() {
        this.subscriptions = [];

        const completionProvider = new CompletionProvider({
            provideSchema: (doc) => {
                if (this.schemaProvider) return this.schemaProvider(doc);
                else return Promise.resolve();
            }
        });

        const formattingProvider = new FormattingProvider();

        let documentSelector: DocumentSelector = [{ language: 'sql' }, { language: 'sqlite' }];
        this.subscriptions.push(languages.registerDocumentFormattingEditProvider(documentSelector, formattingProvider));
        this.subscriptions.push(languages.registerCompletionItemProvider(documentSelector, completionProvider, '.'));
    }

    setSchemaProvider(schemaProvider: (doc: TextDocument) => Thenable<Schema|void>) {
        this.schemaProvider = schemaProvider;
    }

    dispose() {
        Disposable.from(...this.subscriptions).dispose();
    }
}