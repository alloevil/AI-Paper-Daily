"""
REPL environment logger (simplified, no rich dependency).
"""

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class CodeExecution:
    code: str
    stdout: str
    stderr: str
    execution_number: int
    execution_time: Optional[float] = None


class REPLEnvLogger:
    def __init__(self, max_output_length: int = 2000, enabled: bool = True):
        self.enabled = enabled
        self.executions: List[CodeExecution] = []
        self.execution_count = 0
        self.max_output_length = max_output_length
    
    def _truncate_output(self, text: str) -> str:
        if len(text) <= self.max_output_length:
            return text
        half_length = self.max_output_length // 2
        first_part = text[:half_length]
        last_part = text[-half_length:]
        truncated_chars = len(text) - self.max_output_length
        return f"{first_part}\n\n... [TRUNCATED {truncated_chars} characters] ...\n\n{last_part}"
    
    def log_execution(self, code: str, stdout: str, stderr: str = "", execution_time: Optional[float] = None) -> None:
        self.execution_count += 1
        execution = CodeExecution(
            code=code,
            stdout=stdout,
            stderr=stderr,
            execution_number=self.execution_count,
            execution_time=execution_time
        )
        self.executions.append(execution)
    
    def display_last(self) -> None:
        if not self.enabled or not self.executions:
            return
        self._display_single_execution(self.executions[-1])
    
    def display_all(self) -> None:
        if not self.enabled:
            return
        for execution in self.executions:
            self._display_single_execution(execution)
    
    def _display_single_execution(self, execution: CodeExecution) -> None:
        if not self.enabled:
            return
        display_code = self._truncate_output(execution.code)
        print(f"\n{'='*60}")
        print(f"  In [{execution.execution_number}]:")
        print(f"{'='*60}")
        for line in display_code.split('\n'):
            print(f"  | {line}")
        print(f"{'='*60}")
        
        if execution.stderr:
            display_stderr = self._truncate_output(execution.stderr)
            print(f"  Error [{execution.execution_number}]:")
            print(f"  {display_stderr}")
        elif execution.stdout:
            display_stdout = self._truncate_output(execution.stdout)
            print(f"  Out [{execution.execution_number}]:")
            print(f"  {display_stdout}")
        
        if execution.execution_time is not None:
            print(f"  Execution time: {execution.execution_time:.4f}s")
        print()
