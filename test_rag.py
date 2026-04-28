from app import rag_chain
import sys

try:
    print("Testing rag_chain.invoke...")
    response = rag_chain.invoke({"input": "What is medical chatbot?"})
    print(f"Response: {response['answer']}")
except Exception as e:
    import traceback
    print(f"Error: {str(e)}")
    traceback.print_exc()
