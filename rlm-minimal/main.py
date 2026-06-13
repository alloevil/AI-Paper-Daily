"""
RLM Minimal Demo — Needle-in-a-Haystack with mify models.

Usage:
    python main.py

Environment:
    LLM_API_KEY or MIFY_API_KEY — mify API key
"""

from rlm.rlm_repl import RLM_REPL
import random


def generate_massive_context(num_lines: int = 100_000, answer: str = "1298418") -> str:
    """Generate a large context with a hidden magic number."""
    print(f"Generating context with {num_lines} lines...")
    
    random_words = ["blah", "random", "text", "data", "content", "information", "sample"]
    
    lines = []
    for _ in range(num_lines):
        num_words = random.randint(3, 8)
        line_words = [random.choice(random_words) for _ in range(num_words)]
        lines.append(" ".join(line_words))
    
    # Insert the magic number at a random position
    magic_position = random.randint(num_lines // 4, 3 * num_lines // 4)
    lines[magic_position] = f"The magic number is {answer}"
    
    print(f"Magic number inserted at position {magic_position}")
    
    return "\n".join(lines)


def main():
    print("=" * 60)
    print("  RLM Minimal Demo — Needle-in-a-Haystack")
    print("  Using mify model endpoint")
    print("=" * 60)
    
    answer = str(random.randint(1000000, 9999999))
    
    # Use fewer lines for faster demo (100K instead of 1M)
    context = generate_massive_context(num_lines=100_000, answer=answer)

    rlm = RLM_REPL(
        model="xiaomi/mimo-v2.5",           # Root model
        recursive_model="xiaomi/mimo-v2.5",  # Sub-LLM model (can use smaller for speed)
        enable_logging=True,
        max_iterations=10
    )
    
    query = "I'm looking for a magic number. What is it?"
    result = rlm.completion(context=context, query=query)
    
    print(f"\n{'='*60}")
    print(f"  Result:   {result}")
    print(f"  Expected: {answer}")
    print(f"  Match:    {result and answer in result}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
