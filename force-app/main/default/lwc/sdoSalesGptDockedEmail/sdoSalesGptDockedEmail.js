import { LightningElement, track, api } from "lwc";
// import getResponse from "@salesforce/apex/OpenAIController.getResponse";
import { ShowToastEvent } from "lightning/platformShowToastEvent";

export default class SdoSalesGptDockedEmail extends LightningElement {
  loading = false;
  loadingMessage = "Looking up contact details...";
  showMenu = false;
  wordCount = 0;
  subject = "Enter Subject";
  sending = false;
  hidden = true;
  @track _email;

  @api
  get email() {
    return this._email;
  }
  set email(value) {
    this._email = value;
    if (value) {
      this.hidden = false;
      // console.log(JSON.stringify(value));
    } else {
      this.hidden = true;
    }
  }

  initialSelection = [
    {
      id: "003g700000jzuATIAJ",
      sObjectType: "Contact",
      icon: "standard:contact",
      title: "Mya Williams",
      subtitle: "Not a valid record"
    }
  ];
  formats = [
    'font',
    'bold',
    'italic',
    'underline',
    'align',
  ];
  errors = [];
  recentlyViewed = [];
  newRecordOptions = [
    { value: "Account", label: "New Account" },
    { value: "Opportunity", label: "New Opportunity" }
  ];

  handleLookupSelectionChange(event) {
    console.log("Event: ", JSON.stringify(event));
  }

  handleLookupSearch(event) {
    console.log("Event: ", JSON.stringify(event));
  }

  @track emailBody = "Compose Email...";

  items = [
    {
      id: "1",
      label: "Send New Product Info (Without CRM Data)",
      subject: "Introducing Our Newest Product - Don't Miss Out!",
      body: "<p>Dear [Customer's Name],</p><br><p>We have fantastic news for you! 🎉 We've just added an incredible new item to our inventory that could significantly boost your value and revenue! 🚀</p><br><p>This product is a game-changer, and we're excited to discuss how it can benefit your business. Please hop on a call at your earliest convenience so we can provide more details and answer any questions you may have. Your success is our priority!</p><br><p>Warm regards,</p><p>[Your Name]</p><p>[Your Title]</p><p>[Your Company]</p><p>[Your Contact Information]</p>", 
      prompt:
        "You are a sales representative writing an email to a customer. You have a new item in stock that you would like to introduce to the customer for a purchase. Acknowledge the value and revenue this item could bring the customer if they purchase it, and add a call to action for the customer to hop on a call at their earliest convenience if they are interested or have any questions. Keep the content short, no more than 5 sentences, and express enthusiasm using exclamation points and emphatic words.",
      hawking: false
    },
    {
      id: "2",
      subject: "Introducing the K3 Alpine Jacket",
      label: "Send New Product Info (With CRM Data)",
      body: "<p>Hi [Customer's Name],</p><br><p>Introducing the K3 Alpine Jacket, your ultimate companion for conquering the outdoors! Made from high-quality 3-layer GORE-TEX Pro fabric, this lightweight, versatile jacket offers exceptional waterproofing, wind resistance, and breathability! Its innovative design ensures unrestricted movement, while advanced ventilation, ample storage, and reinforced high-wear areas provide durability and functionality! Complete with reflective details for enhanced visibility and a packable design, the K3 Alpine Jacket delivers unbeatable performance and protection for all your adventures! 🌟</p><br><p>This incredible jacket will elevate your outdoor experience and benefit your organization with its top-notch features. I'd love to discuss how the K3 Alpine Jacket can specifically cater to Big 5 Sporting Goods. Please book a call with us at sf.co/048282je at your earliest convenience!</p><br><p>Warm regards,</p><p>Michelle Jung</p><p>Northern Trail Outfitters</p>", 
      prompt:
        "The seller is Michelle Jung and the customer is Jason Luna. The customers company name is Big 5 Sporting Goods. The seller has owned Big 5 for 5 years. Create an email in English from Michelle Jung at Norther Trail Outfitters to Jason Luna at Big 5 Sporting Goods introducing the product the K3 Alpine Jacket, which is Introducing the K3 Alpine Jacket, your ultimate companion for conquering the outdoors. Made from high-quality 3-layer GORE-TEX Pro fabric, this lightweight, versatile jacket offers exceptional waterproofing, wind resistance, and breathability. Its innovative design ensures unrestricted movement, while advanced ventilation, ample storage, and reinforced high-wear areas provide durability and functionality. Complete with reflective details for enhanced visibility and a packable design, the K3 Alpine Jacket delivers unbeatable performance and protection for all your adventures., and explain how it can help Jason Luna and their organization. End the email with a call to action asking Jason Luna to book a call at sf.co/048282je. Keep the content short, no more than 5 sentences, and express enthusiasm using exclamation points and emphatic words. Do not include a subject.",
      hawking: true
    },
    { id: "3", subject: "Follow-Up on Our Previous Conversation", label: "Follow Up on Prior Engagement", body: "<p>Dear [Customer's Name],</p><br><p>I hope this email finds you well. I wanted to follow up on our previous engagement and express my appreciation for the valuable discussion we had. Your insights and feedback were truly valuable.</p><br><p>As we discussed, [briefly summarize the key points of the previous conversation and any action items]. I wanted to check in and see if there have been any developments on your end or if you have any further questions or concerns.</p><br><p>I am committed to assisting you in any way I can and ensuring your satisfaction. Please don't hesitate to reach out to me at [your contact information] to continue our conversation or address any queries you may have.</p><br><p>Thank you for considering our partnership, and I look forward to the opportunity to work together.</p><br><p>Best regards,</p><p>[Your Name]</p><p>[Your Title]</p><p>[Your Company]</p><p>[Your Contact Information]</p>", 
    prompt: "", hawking: true },
    { id: "4", subject: "Pricing Information for [Product/Service]", label: "Offer Pricing Information", body: "<p>Dear [Customer's Name],</p><p>&nbsp;</p><p>I hope this email finds you well. I appreciate your interest in [Product/Service] and the opportunity to provide you with our pricing information.</p><p>&nbsp;</p><p>We have carefully reviewed your requirements and are pleased to present the following pricing options tailored to your specific needs:</p><ol><li><strong>Option 1:</strong> [Briefly describe Option 1 and its pricing]</li><li><strong>Option 2:</strong> [Briefly describe Option 2 and its pricing]</li><li><strong>Option 3:</strong> [Briefly describe Option 3 and its pricing]</li></ol><p>&nbsp;</p><p>Please note that all our pricing options are designed to offer maximum value and flexibility, ensuring your satisfaction.</p><p>&nbsp;</p><p>If you have any questions, would like further clarification, or need assistance in choosing the best option for your business, please do not hesitate to contact me at [your contact information].</p><p>&nbsp;</p><p>Thank you for considering [Your Company] for your [Product/Service] needs. We look forward to the opportunity to work with you.</p><p>&nbsp;</p><p>Best regards,</p><p>[Your Name]</p><p>[Your Title]</p><p>[Your Company]</p><p>[Your Contact Information]</p>", 
    prompt: "", hawking: true },
    { id: "5", subject: "New Case Study: [Case Study Title] - Success Story", label: "Share a Case Study", body: "<p>Dear [Recipient's Name],</p><p>&nbsp;</p><p>I hope this email finds you well. We are excited to share our latest success story with you! Our recently completed case study, [Case Study Title], highlights how we helped [Client's Name] overcome their challenges and achieve outstanding results.</p><p>&nbsp;</p><p>In this case study, you will discover:</p><ul><li>[Key Challenge #1]: How we tackled and resolved [describe the challenge].</li><li>[Key Challenge #2]: Insights into addressing [describe the challenge].</li><li>[Results Achieved]: The impressive outcomes and improvements we achieved together.</li></ul><p>This case study showcases the tangible benefits of partnering with us and offers valuable insights that can help you make informed decisions for your own projects.</p><p>&nbsp;</p><p>You can access the full case study by clicking the link below: [Insert Case Study Link]</p><p>&nbsp;</p><p>If you have any questions or would like to discuss how these strategies might apply to your unique situation, please feel free to reach out to me at [Your Contact Information]. We'd be delighted to explore how we can help you achieve similar success.</p><p>&nbsp;</p><p>Thank you for your continued interest in our services, and we look forward to hearing from you soon.</p><p>&nbsp;</p><p>Best regards,</p><p>[Your Name]</p><p>[Your Title]</p><p>[Your Company]</p><p>[Your Contact Information]</p>", 
    prompt: "", hawking: true },
    { id: "6", subject: "Industry News Discussion", label: "Discuss Industry News", body: "<p>Dear [Recipient's Name],</p><p>&nbsp;</p><p>I hope this email finds you in good health. I wanted to touch base and share some recent developments in our industry that I believe will be of interest to you.</p><p>&nbsp;</p><p>[Summarize the key industry news or trends you want to discuss briefly.]</p><p>&nbsp;</p><p>I'd love to hear your thoughts on these developments and how they might impact our respective organizations. Could we schedule a brief call or meeting to discuss these insights further? Your expertise and perspective would be highly valuable.</p><p>&nbsp;</p><p>Please let me know your availability, and I'll coordinate a suitable time. If you prefer to share your thoughts via email, that works too!</p><p>&nbsp;</p><p>Looking forward to our discussion.</p><p>&nbsp;</p><p>Best regards,</p><p>[Your Name]</p><p>[Your Title]</p><p>[Your Company]</p><p>[Your Contact Information]</p>", 
    prompt: "", hawking: true }
  ];

  toggleMenu() {
    this.showMenu = !this.showMenu;
  }

  selectItem(event) {
    event.preventDefault();
    let id = event.currentTarget.dataset.id;
    const selectedItem = this.items.find((item) => item.id === id);
    selectedItem.to = this._email.to;
    // console.log('selectedItem',JSON.stringify(selectedItem));
    this._email = selectedItem;
    // console.log('email',JSON.stringify(this._email));
    // this.loading = true;
    this.toggleMenu();
    // this.getOpenAPIResponse(selectedItem.prompt, selectedItem.subject);
  }

  stopLoading(timeoutValue) {
    // eslint-disable-next-line
    setTimeout(() => {
      this.loading = false;
    }, timeoutValue);
  }

  // getOpenAPIResponse(prompt, subject) {
  //   getResponse({ searchString: prompt })
  //     .then((result) => {
  //       let response = JSON.parse(JSON.stringify(JSON.parse(result)));
  //       if (response.error) {
  //         console.log(response.error.message);
  //         this.postError(response.error.message);
  //       } else {
  //         console.log(response);
  //         this.emailBody = "";
  //         //let suggestion = response.generations[0].text;
  //         let suggestion = response.choices[0].message.content;
  //         suggestion = suggestion.replace(/[\n\r]/g, "<br>");
  //         //suggestion = suggestion.substring(8);
  //         console.log(suggestion);
  //         // eslint-disable-next-line
  //         setTimeout(() => {
  //           this.loadingMessage = "Writing your email...";
  //           this.stopLoading(300);
  //           this.typeMessage(suggestion);
  //           this.subject = subject;
  //         }, 300);
  //       }
  //     })
  //     .catch((error) => {
  //       console.log("error is " + error);
  //       this.postError(error);
  //     });
  // }

  postError(error) {
    const event = new ShowToastEvent({
      title: "Error",
      message: error,
      variant: "error"
    });
    this.dispatchEvent(event);
  }

  typeMessage(value) {
    this.typing = true;
    let speed = 15;
    let words = value.split(" ");
    if (this.wordCount < words.length) {
      // eslint-disable-next-line @lwc/lwc/no-async-operation
      setTimeout(() => {
        this.emailBody += words[this.wordCount] + " ";
        this.wordCount++;
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
          this.typeMessage(value);
        }, speed);
      }, 25);
    } else {
      this.typing = false;
      this.wordCount = 0;
    }
  }

  sendEmail() {
    this.sending = true;
    // eslint-disable-next-line
    setTimeout(() => {
      this.hidden = true;
      const event = new ShowToastEvent({
        title: "Success!",
        message: "Email has been sent to " + this._email.to,
        variant: "success"
      });
      this.dispatchEvent(event);
      this._email = null;
      this.sending = false;
    }, 1000);
  }

  closeUtilityBar() {
    this.hidden = true;
    this._email = null;
  }
}