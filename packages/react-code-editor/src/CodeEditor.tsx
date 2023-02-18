import { EditorState, basicSetup } from '@codemirror/basic-setup';
import { indentWithTab } from '@codemirror/commands';
import { EditorView, keymap } from '@codemirror/view';
import { reka as rekaCodemirrorExtension } from '@rekajs/codemirror';
import { Parser } from '@rekajs/parser';
import { useReka } from '@rekajs/react';
import * as t from '@rekajs/types';
import debounce from 'lodash/debounce';
import * as React from 'react';

const _diffASTArrayTypes = <T extends t.Type>(
  program: t.Program,
  newProgram: t.Program,
  getTarget: (program: t.Program) => T[],
  isEqual: (a: T, b: T) => boolean
) => {
  const currentComponents = getTarget(program);
  const newComponents = getTarget(newProgram);

  const componentsToInsert: [T, number][] = [];

  newComponents.forEach((newComponent, i) => {
    const existingComponent = currentComponents.find((oldComponent) =>
      isEqual(oldComponent, newComponent)
    );

    if (!existingComponent) {
      componentsToInsert.push([newComponent, i]);
      return;
    }

    t.merge(existingComponent, newComponent);
  });

  componentsToInsert.forEach(([component, index], i) => {
    currentComponents.splice(index + i, 0, component);
  });

  currentComponents
    .filter(
      (oldComponent) =>
        !newComponents.find((newComponent) =>
          isEqual(oldComponent, newComponent)
        )
    )
    .forEach((component) => {
      currentComponents.splice(currentComponents.indexOf(component), 1);
    });
};

const diffAST = (program: t.Program, newProgram: t.Program) => {
  // Diff Globals
  _diffASTArrayTypes(
    program,
    newProgram,
    (program) => program.globals,
    (a, b) => a.name === b.name
  );

  // Diff components
  _diffASTArrayTypes(
    program,
    newProgram,
    (program) => program.components,
    (a, b) => a.name === b.name
  );
};

type ParsingStatus = {
  type: 'parsing';
};

type ErrorStatus = {
  type: 'error';
  error: string;
};

type SuccessStatus = {
  type: 'success';
};

export type ParserStatus = ParsingStatus | ErrorStatus | SuccessStatus;

type CodeEditorProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
> & {
  onStatusChange?: (status: ParserStatus) => void;
};

export const CodeEditor = (props: CodeEditorProps) => {
  const { reka } = useReka();

  const domRef = React.useRef<HTMLDivElement | null>(null);
  const propsRef = React.useRef<CodeEditorProps>(props);
  propsRef.current = props;

  const currentStateRef = React.useRef(t.Schema.fromJSON(reka.program));
  const currentCodeStringRef = React.useRef<string>(
    Parser.stringify(reka.program)
  );

  const isSynchingFromCodeMirror = React.useRef(false);
  const isSynchingFromExternal = React.useRef(false);
  const isTypingRef = React.useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const syncCodeToState = React.useCallback(
    debounce((code: string) => {
      const { current: props } = propsRef;

      if (isSynchingFromExternal.current) {
        return;
      }

      isSynchingFromCodeMirror.current = true;
      try {
        const newAST = Parser.parseProgram(code);
        reka.change(() => {
          diffAST(currentStateRef.current, newAST);
          diffAST(reka.program, currentStateRef.current);
        });

        props.onStatusChange?.({
          type: 'success',
        });
      } catch (error) {
        props.onStatusChange?.({
          type: 'error',
          error: (error as unknown as any).message as string,
        });
      }
      isSynchingFromCodeMirror.current = false;
      isTypingRef.current = false;
    }, 1000),
    [reka]
  );

  const [codemirrorView, setCodemirrorView] = React.useState<EditorView | null>(
    null
  );

  React.useLayoutEffect(() => {
    const dom = domRef.current;

    if (!dom) {
      return;
    }

    const { current: props } = propsRef;

    setCodemirrorView(
      new EditorView({
        state: EditorState.create({
          doc: currentCodeStringRef.current,
          extensions: [
            basicSetup,
            keymap.of([indentWithTab]),
            rekaCodemirrorExtension(),
            EditorView.theme({
              '&': {
                height: '100%',
              },
              '&.cm-focused': {
                outline: 'none!important',
              },
              '.cm-scroller': {
                'font-family': "'JetBrains Mono'",
                fontSize: '0.875em',
                lineHeight: '1.6em',
                wordBreak: 'break-word',
                '-webkit-font-smoothing': 'initial',
              },
            }),
            EditorView.updateListener.of((view) => {
              if (!view.docChanged || isSynchingFromExternal.current) {
                return;
              }

              isTypingRef.current = true;

              currentCodeStringRef.current = view.state.doc.toString();

              props.onStatusChange?.({
                type: 'parsing',
              });

              syncCodeToState(currentCodeStringRef.current);
            }),
          ],
        }),
        parent: dom,
      })
    );
  }, [syncCodeToState]);

  const onExternalChange = React.useCallback(() => {
    if (isSynchingFromCodeMirror.current || isTypingRef.current) {
      return;
    }

    if (!codemirrorView) {
      return;
    }

    if (isSynchingFromExternal.current === false) {
      isSynchingFromExternal.current = true;

      Promise.resolve().then(() => {
        const oldCode = currentCodeStringRef.current;
        const newCode = Parser.stringify(reka.program);

        if (newCode === oldCode) {
          isSynchingFromExternal.current = false;
          return;
        }

        currentStateRef.current = t.Schema.fromJSON(reka.program);

        const transaction = codemirrorView.state.update({
          changes: {
            from: 0,
            to: codemirrorView.state.doc.length,
            insert: newCode,
          },
        });

        currentCodeStringRef.current = newCode;
        codemirrorView.dispatch(transaction);
        isSynchingFromExternal.current = false;
      });
    }
  }, [reka, codemirrorView]);

  // If the AST changes (ie: from undo/redo or from multiplayer),
  // Then, sync those changes to the CodeMirror editor
  React.useEffect(() => {
    const unsubscribe = reka.listenToChanges((payload) => {
      if (payload.event !== 'change') {
        return;
      }

      onExternalChange();
    });

    return () => {
      unsubscribe();
    };
  }, [reka, codemirrorView, onExternalChange]);

  return <div {...props} ref={domRef} />;
};

CodeEditor.toString = () => '.reka-react-code-editor';
