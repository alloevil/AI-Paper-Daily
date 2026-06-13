"""
REPL environment for RLM with exec-based code execution and sub-LLM calls.
"""

import sys
import io
import threading
import json
import tempfile
import os
import time
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Optional

from rlm import RLM


class Sub_RLM(RLM):
    """Recursive LLM client for REPL environment. Uses mify endpoint."""
    
    def __init__(self, model: str = "xiaomi/mimo-v2.5"):
        from rlm.utils.llm import MifyClient
        self.client = MifyClient(model=model)
        self.model = model
    
    def completion(self, prompt) -> str:
        try:
            response = self.client.completion(
                messages=prompt,
                timeout=300
            )
            return response
        except Exception as e:
            return f"Error making LLM query: {str(e)}"
    
    def cost_summary(self) -> dict[str, float]:
        raise NotImplementedError("Cost tracking is not implemented for the Sub-RLM.")
    
    def reset(self):
        raise NotImplementedError("Reset is not implemented for the Sub-RLM.")


@dataclass
class REPLResult:
    stdout: str
    stderr: str
    locals: dict
    execution_time: float

    def __init__(self, stdout: str, stderr: str, locals: dict, execution_time: float = None):
        self.stdout = stdout
        self.stderr = stderr
        self.locals = locals
        self.execution_time = execution_time
    
    def __str__(self):
        return f"REPLResult(stdout={self.stdout}, stderr={self.stderr}, locals={list(self.locals.keys())}, execution_time={self.execution_time})"


class REPLEnv:
    def __init__(
        self,
        recursive_model: str = "xiaomi/mimo-v2.5",
        context_json: Optional[dict | list] = None,
        context_str: Optional[str] = None,
        setup_code: str = None,
    ):
        self.original_cwd = os.getcwd()
        self.temp_dir = tempfile.mkdtemp(prefix="repl_env_")

        # Initialize sub-RLM client
        self.sub_rlm: RLM = Sub_RLM(model=recursive_model)
        
        # Create safe globals
        self.globals = {
            '__builtins__': {
                'print': print, 'len': len, 'str': str, 'int': int, 'float': float,
                'list': list, 'dict': dict, 'set': set, 'tuple': tuple, 'bool': bool,
                'type': type, 'isinstance': isinstance, 'enumerate': enumerate,
                'zip': zip, 'map': map, 'filter': filter, 'sorted': sorted,
                'min': min, 'max': max, 'sum': sum, 'abs': abs, 'round': round,
                'chr': chr, 'ord': ord, 'hex': hex, 'bin': bin, 'oct': oct,
                'repr': repr, 'ascii': ascii, 'format': format,
                '__import__': __import__, 'open': open,
                'any': any, 'all': all, 'hasattr': hasattr, 'getattr': getattr,
                'setattr': setattr, 'delattr': delattr, 'dir': dir, 'vars': vars,
                'range': range, 'reversed': reversed, 'slice': slice,
                'iter': iter, 'next': next, 'pow': pow, 'divmod': divmod,
                'complex': complex, 'bytes': bytes, 'bytearray': bytearray,
                'memoryview': memoryview, 'hash': hash, 'id': id,
                'callable': callable, 'issubclass': issubclass, 'super': super,
                'property': property, 'staticmethod': staticmethod,
                'classmethod': classmethod, 'object': object,
                'Exception': Exception, 'ValueError': ValueError, 'TypeError': TypeError,
                'KeyError': KeyError, 'IndexError': IndexError,
                'AttributeError': AttributeError, 'FileNotFoundError': FileNotFoundError,
                'OSError': OSError, 'IOError': IOError, 'RuntimeError': RuntimeError,
                'NameError': NameError, 'ImportError': ImportError,
                'StopIteration': StopIteration, 'GeneratorExit': GeneratorExit,
                'SystemExit': SystemExit, 'KeyboardInterrupt': KeyboardInterrupt,
                # Block dangerous builtins
                'input': None, 'eval': None, 'exec': None, 'compile': None,
                'globals': None, 'locals': None, 'breakpoint': None,
            },
            '__name__': '__repl__',
        }
        
        # Initialize context
        self.context = context_json or {}
        self.context_str = context_str or ""
        self.locals = {}
        
        # Set up the context variable and llm_query function
        self.globals['context'] = self.context
        self.globals['llm_query'] = self._llm_query
        
        # Run setup code if provided
        if setup_code:
            self._exec(setup_code)
    
    def _llm_query(self, prompt: str) -> str:
        """Query the sub-LLM from within the REPL environment."""
        messages = [{"role": "user", "content": str(prompt)}]
        return self.sub_rlm.completion(messages)
    
    def _exec(self, code: str) -> REPLResult:
        """Execute code in the REPL environment."""
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        
        start_time = time.time()
        
        try:
            sys.stdout = stdout_capture
            sys.stderr = stderr_capture
            
            # Merge globals and locals for execution
            exec_globals = {**self.globals, **self.locals}
            exec(code, exec_globals)
            
            # Update locals (excluding builtins and internal vars)
            self.locals = {
                k: v for k, v in exec_globals.items() 
                if k not in self.globals and not k.startswith('_')
            }
            
        except Exception as e:
            stderr_capture.write(f"Error: {type(e).__name__}: {str(e)}")
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr
            
        execution_time = time.time() - start_time
        
        return REPLResult(
            stdout=stdout_capture.getvalue(),
            stderr=stderr_capture.getvalue(),
            locals=dict(self.locals),
            execution_time=execution_time
        )
    
    def code_execution(self, code: str) -> REPLResult:
        """Execute code and return result."""
        return self._exec(code)
