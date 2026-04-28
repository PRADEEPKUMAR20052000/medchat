from flask import Flask, render_template, jsonify, request
from src.helper import download_hugging_face_embeddings
from langchain_pinecone import PineconeVectorStore
from langchain_groq import ChatGroq
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv
from src.prompt import *
import os
import sys
import logging
from werkzeug.utils import secure_filename
import base64

# Configure logging
logging.basicConfig(
    filename='app_debug.log',
    level=logging.DEBUG,
    format='%(asctime)s %(levelname)s %(name)s %(threadName)s : %(message)s'
)

from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Configuration for uploads
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

load_dotenv()

PINECONE_API_KEY=os.environ.get('PINECONE_API_KEY')
OPENAI_API_KEY=os.environ.get('OPENAI_API_KEY')
GROQ_API_KEY=os.environ.get('GROQ_API_KEY')

if PINECONE_API_KEY:
    os.environ["PINECONE_API_KEY"] = PINECONE_API_KEY
if OPENAI_API_KEY:
    os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY
if GROQ_API_KEY:
    os.environ["GROQ_API_KEY"] = GROQ_API_KEY

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

embeddings = download_hugging_face_embeddings()
index_name = "medical-chatbot" 
docsearch = PineconeVectorStore.from_existing_index(index_name=index_name, embedding=embeddings)
retriever = docsearch.as_retriever(search_type="similarity", search_kwargs={"k":3})

chatModel = ChatGroq(model="llama-3.3-70b-versatile", groq_api_key=GROQ_API_KEY)
# Vision model for images
visionModel = ChatGroq(model="meta-llama/llama-4-scout-17b-16e-instruct", groq_api_key=GROQ_API_KEY)

prompt = ChatPromptTemplate.from_messages(
    [
        ("system", system_prompt),
        ("human", "{input}"),
    ]
)

question_answer_chain = create_stuff_documents_chain(chatModel, prompt)
rag_chain = create_retrieval_chain(retriever, question_answer_chain)



@app.route("/")
def index():
    return render_template('chat.html')



import sys

@app.route("/upload", methods=["POST"])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        file_ext = filename.rsplit('.', 1)[1].lower()
        
        try:
            language = request.form.get("language", "en")
            language_map = {"es": "Spanish", "fr": "French", "de": "German", "hi": "Hindi"}
            lang_name = language_map.get(language, "English")
            lang_instruction = f" Please reply entirely in {lang_name}." if language != "en" else ""

            if file_ext == 'pdf':
                from pypdf import PdfReader
                reader = PdfReader(filepath)
                text = ""
                for page in reader.pages:
                    text += page.extract_text()
                
                # Analyze text with Groq
                prompt = f"Analyze this medical prescription text and give advice on the medicines mentioned. Be professional but clear.{lang_instruction} Text: {text}"
                response = chatModel.invoke(prompt)
                analysis = response.content
            else:
                # Image processing with Vision model
                with open(filepath, "rb") as image_file:
                    image_base64 = base64.b64encode(image_file.read()).decode('utf-8')
                
                from langchain_core.messages import HumanMessage
                
                message = HumanMessage(
                    content=[
                        {"type": "text", "text": f"Analyze this medical prescription image. Identify the medicines, dosages, and provide general advice. Mention if anything is unclear.{lang_instruction}"},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                        },
                    ]
                )
                response = visionModel.invoke([message])
                analysis = response.content
            
            return jsonify({"analysis": analysis})
            
        except Exception as e:
            logging.error(f"Upload processing error: {str(e)}", exc_info=True)
            return jsonify({"error": str(e)}), 500
    
    return jsonify({"error": "Invalid file type"}), 400

@app.route("/get", methods=["POST"])
def chat():
    logging.info("Request received at /get")
    try:
        data = request.get_json(force=True)
        msg = data.get("msg")
        language = data.get("language", "en")
        logging.info(f"User Request: {msg}")
        
        if not msg:
            logging.warning("No message provided in request")
            return jsonify({"error": "No message provided"}), 400
            
        if language != "en":
            language_map = {"es": "Spanish", "fr": "French", "de": "German", "hi": "Hindi"}
            lang_name = language_map.get(language, "English")
            msg = f"{msg}\n\n(IMPORTANT: Please reply entirely in {lang_name})"
        
        response = rag_chain.invoke({"input": msg})
        answer = response["answer"]
        logging.info(f"AI Response success")
        return jsonify({"answer": answer})
    except Exception as e:
        logging.error(f"Error in chat endpoint: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500



if __name__ == '__main__':
    app.run(host="0.0.0.0", port= 5000, debug= False)
