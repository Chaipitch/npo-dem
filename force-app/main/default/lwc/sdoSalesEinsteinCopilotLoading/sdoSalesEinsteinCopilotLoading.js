import { LightningElement, track } from 'lwc';
import einsteinLoadingResource from '@salesforce/resourceUrl/SDO_EinsteinLoadingGIF';
import einsteinAvatarResource from '@salesforce/resourceUrl/SDOSalesGptAvatar';

export default class SdoSalesEinsteinCopilotLoading extends LightningElement {
    einsteinLoading = einsteinLoadingResource;
    einsteinAvatar = einsteinAvatarResource;
    texts = [
        "Analyzing your request",
        "Figuring out next steps",
        "Working",
        "Finishing up"
    ];
    @track typedText = ''; // The text that will be displayed on the component
    @track step1 = false;
    @track step2 = false;
    @track step3 = false;
    @track step4 = false;
    currentTextIndex = 0; // Index to keep track of which string we're typing out
    letterIndex = 0; // Index to keep track of which character we're typing out

    // intervals = [5000, 7000, 7000, 7000]; // Time intervals in milliseconds

    // textIndex = 0;
    // charIndex = 0;
    // timeoutId;

    // // @api typedText;

    // // Declare starContainer outside of any functions
    // starContainer = this.template.querySelector('.star-container');

    connectedCallback() {
        this.typeNextCharacter();
    }

    renderedCallback() {
        // this.advanceText();
    }
    // Function to initialize the stars with opacity 0
    // initializeStars() {
    //     const stars = this.template.querySelectorAll('.starfade');
    //     stars.forEach((star) => {
    //         star.style.opacity = '0';
    //     });
    // }


    typeNextCharacter() {
        // Get the current text and the current character to type out
        const currentText = this.texts[this.currentTextIndex];
        const currentChar = currentText.charAt(this.letterIndex);
        // console.log('currentText length',currentText.length);

        // console.log('letterIndex',this.letterIndex);
        // Update the typedText with the current character
        this.typedText += currentChar;
        this.letterIndex++;

        // if (this.letterIndex == 1) {
        //     this.fadeInStars();
        // }

        // Check if the current string has been fully typed
        if (this.letterIndex < currentText.length) {
            // If not, keep typing
            if ((this.letterIndex + 1) == currentText.length) {
                this.fadeInStars();
            }
            setTimeout(() => this.typeNextCharacter(), 40); // Adjust the typing speed here
        } else {
            // If the string is complete, move to the next string after a delay

            setTimeout(() => {
                this.fadeOutStars();
                this.prepareForNextString()
            }, 900); // Adjust the delay before typing the next string
        }
    }

    prepareForNextString() {
        if (this.currentTextIndex === this.texts.length - 1) {
            // Stop the typing effect since we've reached the end
            this.step4 = true;
            setTimeout(() => {
                let step4Ele = this.template.querySelector('.step4');
                // console.log(step4Ele);
                step4Ele.scrollIntoView(true);
            },50);
            return; // Optionally, you can implement some final action here
        }
        if (this.currentTextIndex === 0) {
            this.step1 = true;
            setTimeout(() => {
                let step1Ele = this.template.querySelector('.step1');
                // console.log(step1Ele);
                step1Ele.scrollIntoView(true);
            },50);
        }
        if (this.currentTextIndex === 1) {
            this.step2 = true;
            setTimeout(() => {
                let step2Ele = this.template.querySelector('.step2');
                // console.log(step2Ele);
                step2Ele.scrollIntoView(true);
            },50);
        }
        if (this.currentTextIndex === 2) {
            this.step3 = true;
            setTimeout(() => {
                let step3Ele = this.template.querySelector('.step3');
                // console.log(step3Ele);
                step3Ele.scrollIntoView(true);
            },50);
        }
        
        // resultSelector.scrollIntoView(true);
        
        // debugger;

        // Reset for the next string if we haven't reached the end
        this.letterIndex = 0;
        this.typedText = '';
        this.currentTextIndex++;

        // Start typing the next string
        this.typeNextCharacter();

    }
    scrollToStep() {

        let event = new CustomEvent('egpt_messagetyping', {
            detail: {
                value: true
            },
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);

    }
    // type() {
    //     if (this.textIndex < this.texts.length) {
    //         const currentText = this.texts[this.textIndex];
    //         console.log('currentText', currentText);
    //         console.log('this.textIndex', this.textIndex);
    //         console.log('this.charIndex', this.charIndex);
    //         console.log('this.typedText', this.typedText);
    //         if (this.charIndex <= currentText.length) {
    //             this.typedText = currentText.substring(0, this.charIndex);
    //             // console.log('text', this.template.querySelector('.typewriter-text').textContent);
    //             // console.log('characters', currentText.substring(0, this.charIndex));
    //             // this.template.querySelector('.typewriter-text').textContent = currentText.substring(0, this.charIndex);
    //             this.charIndex++;
    //             this.timeoutId = setTimeout(this.type(), 900 / currentText.length);
    //         } else {
    //             clearTimeout(this.timeoutId); // Clear any existing timeouts
    //             setTimeout(() => {
    //                 this.fadeOutStars(() => {
    //                     this.advanceText(); // Transition to the next text after fading out the stars
    //                 });
    //             }, this.intervals[this.textIndex] - 0); // Wait for the specified interval minus 0 milliseconds before fading out stars
    //         }
    //     }
    // }

    // advanceText() {
    //     this.charIndex = 0;
    //     this.textIndex = (this.textIndex + 1) % this.texts.length;

    //     // console.log('this.textIndex', this.textIndex);
    //     // console.log('this.charIndex', this.charIndex);
    //     let starCont = this.template.querySelector('.star-container');
    //     // console.log(starCont);
    //     // Show the star container before typing the next text
    //     starCont.style.visibility = 'visible';

    //     this.type(); // Start typing the next text

    //     // Reduce the initial delay for the first typewrite effect
    //     const fadeInDelay = 1000;

    //     // Delay before fading in stars
    //     setTimeout(() => {
    //         this.fadeInStars(); // Start fading in the stars after the typewriter effect completes
    //     }, fadeInDelay); // Wait for 500ms for the first text, 1500ms for others before fading in stars
    // }

    fadeInStars() {
        const stars = this.template.querySelectorAll('.starfade');
        let opacity = 0;
        let starIndex = 0;

        function step() {
            if (starIndex < stars.length) {
                opacity += 0.2; // Adjust the step size as needed
                stars[starIndex].style.opacity = String(opacity);

                if (opacity >= 1) {
                    starIndex++;
                    opacity = 0;
                }

                requestAnimationFrame(step);
            }
        }

        step();
    }

    fadeOutStars(callback) {
        const stars = this.template.querySelectorAll('.starfade');
        let opacity = 1;

        function step() {
            opacity -= 0.1; // Adjust the step size as needed
            stars.forEach((star) => {
                star.style.opacity = String(opacity);
            });

            if (opacity > 0) {
                requestAnimationFrame(step);
            } else {
                if (typeof callback === 'function') {
                    callback(); // Call the callback function when the stars finish fading out
                }
            }
        }

        step();
    }
}