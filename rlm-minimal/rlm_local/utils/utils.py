"""
Utility functions for the RLM REPL Client.
"""

import re
from typing import List, Dict, Optional, Tuple, Any

def find_code_blocks(text: str) -> List[str]:
    """
    Find REPL code blocks in text wrapped in triple backticks and return List of content(s).
    Returns None if no code blocks are found.
    """
    pattern = r'```repl\s*\n(.*?)\n```'
    results = []
    
    for match in re.finditer(pattern, text, re.DOTALL):
        code_content = match.group(1).strip()
        results.append(code_content)
    
    return results if results else None


def find_final_answer(text: str) -> Optional[Tuple[str, str]]:
    """
    Find FINAL(...) or FINAL_VAR(...) statement in response and return (type, content).
    Returns None if neither pattern is found.
    """
    # Check for FINAL_VAR pattern first - must be at start of line
    final_var_pattern = r'^\s*FINAL_VAR\((.*?)\)'
    match = re.search(final_var_pattern, text, re.MULTILINE | re.DOTALL)
    if match:
        return ('FINAL_VAR', match.group(1).strip())
    
    # Check for FINAL pattern - must be at start of line
    final_pattern = r'^\s*FINAL\((.*?)\)'
    match = re.search(final_pattern, text, re.MULTILINE | re.DOTALL)
    if match:
        return ('FINAL', match.group(1).strip())
    
    return None


def add_execution_result_to_messages(messages: List[Dict[str, str]], 
                                   code: str, 
                                   result: str,
                                   max_character_length: int = 100000,
                                   ) -> List[Dict[str, str]]:
    """
    Add code execution result to the conversation messages.
    """
    # Truncate result if it exceeds 100k characters
    if len(result) > max_character_length:
        result = result[:max_character_length] + "..."
    
    # Add the code execution result
    execution_message = {
        "role": "user",
        "content": f"Code executed:\n```python\n{code}\n```\n\nREPL output:\n{result}"
    }
    messages.append(execution_message)
    return messages


def format_execution_result(
    stdout: str,
    stderr: str,
    locals_dict: Dict[str, Any],
    truncate_length: int = 100
) -> str:
    """
    Format the execution result as a string for display.
    """
    result_parts = []
    
    if stdout:
        result_parts.append(f"\n{stdout}")
    
    if stderr:
        result_parts.append(f"\n{stderr}")
    
    # Show some key variables (excluding internal ones)
    important_vars = {}
    for key, value in locals_dict.items():
        if not key.startswith('_') and key not in ['__builtins__', '__name__', '__doc__']:
            try:
                if isinstance(value, (str, int, float, bool, list, dict, tuple)):
                    if isinstance(value, str) and len(value) > truncate_length:
                        important_vars[key] = f"'{value[:truncate_length]}...'"
                    else:
                        important_vars[key] = repr(value)
            except:
                important_vars[key] = f"<{type(value).__name__}>"
    
    if important_vars:
        result_parts.append(f"REPL variables: {list(important_vars.keys())}\n")
    
    return "\n\n".join(result_parts) if result_parts else "No output"


def execute_code(repl_env, code: str, repl_env_logger, logger) -> str:
    """
    Execute code in the REPL environment and return formatted result.
    """
    try:
        result = repl_env.code_execution(code)
        
        formatted_result = format_execution_result(
            result.stdout, result.stderr, result.locals
        )
        repl_env_logger.log_execution(code, result.stdout, result.stderr, result.execution_time)
        repl_env_logger.display_last()

        # Print out tool execution to root
        logger.log_tool_execution("CODE_EXECUTION", formatted_result)
        
        return formatted_result
        
    except Exception as e:
        error_msg = f"Error executing code: {str(e)}"
        return error_msg


def process_code_execution(
    response: str,
    messages: List[Dict[str, str]],
    repl_env,
    repl_env_logger,
    logger,
) -> List[Dict[str, str]]:
    """
    Process code execution from the model response.
    """
    # Extract code blocks from response
    code_blocks = find_code_blocks(response)
    
    if code_blocks:
        # Execute each code block
        for code in code_blocks:
            execution_result = execute_code(repl_env, code, repl_env_logger, logger)
            
            # Add execution result to conversation
            messages = add_execution_result_to_messages(
                messages, code, execution_result, 
            )
    
    return messages


def check_for_final_answer(response: str, repl_env, logger) -> Optional[str]:
    """Check if response contains a final answer."""
    result = find_final_answer(response)
    if result is None:
        return None
    
    answer_type, content = result
    
    if answer_type == 'FINAL':
        return content
    elif answer_type == 'FINAL_VAR':
        # Get the variable directly from the REPL environment
        try:
            variable_name = content.strip().strip('"').strip("'").strip('\n').strip('\r')
            
            if variable_name in repl_env.locals:
                variable_value = repl_env.locals[variable_name]
                return str(variable_value)
            else:
                error_msg = f"Variable '{variable_name}' not found in REPL environment"
                logger.log_tool_execution("FINAL_VAR", error_msg)
                return None
        except Exception as e:
            error_msg = f"Error retrieving variable '{variable_name}': {str(e)}"
            logger.log_tool_execution("FINAL_VAR", error_msg)
            return None


def convert_context_for_repl(context) -> tuple:
    """Convert context to both dict and str formats for REPL."""
    if isinstance(context, str):
        return {"content": context}, context
    elif isinstance(context, list):
        context_str = "\n".join(str(item) for item in context)
        return {"content": context}, context_str
    elif isinstance(context, dict):
        context_str = str(context)
        return context, context_str
    else:
        context_str = str(context)
        return {"content": context_str}, context_str
