const http = require('http');
const url = require('url');
const Customer = require('../models/customer');
const sendEmail = require('../config/email.js')

const reportCardController = {
    // Function to fetch card details and prompt for confirmation
    reportCard: function (req, res) {
        try {
            const parsedUrl = url.parse(req.url, true);
            const cardId = parsedUrl.query.cardId;
            //const cardId = req.query.cardId;
            
            // Placeholder for the database query function
            Customer.getCardNumberByCardId(cardId, (error, cardNumber) => {
                if (error) {
                    console.error('Fetching card number failed:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Fetching card number failed', error }));
                } else {
                    if (!cardNumber) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Card number not found' }));
                    } else {
                        const cardNumberObj = cardNumber[0]; 
                        if (cardNumberObj && cardNumberObj.Card_Number) {
                            const lastFourDigits = cardNumberObj.Card_Number.slice(-4); // Extracting the last 4 digits
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, message: `Are you sure you want to report the card ending with ${lastFourDigits}?`, data: { cardId, cardNumber: cardNumberObj.Card_Number } }));
                        } else {
                            // Handle the case where card number is not found or the structure is not as expected
                            res.writeHead(404, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Card number not found or invalid format' }));
                        }
                    }
                }
            });
        } catch (error) {

            console.error('Fetching card number failed2:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Fetching card number failed', error }));
        }
    },

    //Upadte to inactive


    // confirmReportCard: function (req, res) {
    //     let body = '';

    //     req.on('data', chunk => {
    //         body += chunk;
    //     });

    //     req.on('end', () => {
    //         try {
    //             const requestData = JSON.parse(body);
    //             const cardId = requestData['cardId'];

    //             if (!cardId) {
    //                 res.writeHead(400, { 'Content-Type': 'application/json' });
    //                 res.end(JSON.stringify({ error: 'Missing cardId in the request body' }));
    //             } else {
    //                 // Assuming 'Customer' is your database access module
    //                 Customer.updateCardStatus(cardId, 0, (error, result) => {
    //                     if (error) {
    //                         console.error('Card status update failed:', error);
    //                         res.writeHead(500, { 'Content-Type': 'application/json' });
    //                         res.end(JSON.stringify({ message: 'Card status update failed', error }));
    //                     } else {
    //                         res.writeHead(200, { 'Content-Type': 'application/json' });
    //                         res.end(JSON.stringify({ success: true, message: 'Card status updated successfully', data: { cardId } }));
    //                     }
    //                 });
    //             }
    //         } catch (error) {
    //             console.error('Card status update failed:', error);
    //             res.writeHead(500, { 'Content-Type': 'application/json' });
    //             res.end(JSON.stringify({ message: 'Card status update failed', error }));
    //         }
    //     });
    // }

    confirmReportCard: function (req, res) {
        let body = '';
    
        req.on('data', chunk => {
            body += chunk;
        });
    
        req.on('end', async () => { 
            try {
                const requestData = JSON.parse(body);
                const cardId = requestData['cardId'];
    
                if (!cardId) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing cardId in the request body' }));
                } else {

                    Customer.getCardStatus(cardId, async (statusError, currentStatus) => {
                        if (statusError) {
                            console.error('Fetching card status failed:', statusError);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Fetching card status failed', error: statusError }));
                            return;
                        }

                        if (currentStatus !== 1) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Card is either already inactive or deleted' }));
                            return;
                        }
                    })

                    Customer.getEmailByCardId(cardId, async (error, result) => {
                        if (error || !result.length) {
                            console.error('Fetching email failed:', error);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Fetching email failed', error }));
                        } else {
                            const userEmail = result[0].email;
    
                            // Update the card status
                            Customer.updateCardStatus(cardId, 0, async (updateError, updateResult) => {
                                if (updateError) {
                                    console.error('Card status update failed:', updateError);
                                    res.writeHead(500, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ message: 'Card status update failed', error: updateError }));
                                } else {
                                    // Send an email to the fetched user email
                                    try {
                                        await sendEmail(
                                            userEmail,
                                            'Card Reported',
                                            'Your card has been reported successfully.',
                                            '<p>Your card has been reported successfully.</p>'
                                        );
    
                                        res.writeHead(200, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ success: true, message: 'Card status updated and email sent successfully', data: { cardId } }));
                                    } catch (emailError) {
                                        console.error('Email sending failed:', emailError);
                                        res.writeHead(200, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ success: true, message: 'Card status updated but email sending failed', data: { cardId }, error: emailError }));
                                    }
                                }
                            });
                        }
                    });
                }
            } catch (error) {
                console.error('Card status update failed:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Card status update failed', error }));
            }
        });
    },

    // Delete Card

    deleteCard: function (req, res) {
        let body = '';
    
        req.on('data', chunk => {
            body += chunk.toString(); // Convert buffer to string
        });
    
        req.on('end', async () => {
            try {
                const requestData = JSON.parse(body);
                const cardId = requestData['cardId'];
    
                if (!cardId) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing cardId in the request body' }));
                } else {


                    Customer.getCardStatus(cardId, async (statusError, currentStatus) => {
                        if (statusError) {
                            console.error('Fetching card status failed:', statusError);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Fetching card status failed', error: statusError }));
                            return;
                        }

                        if (currentStatus !== 0) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Card is either active or already deleted'}));
                            return;
                        }
                    })


                    // Fetch the email address associated with the cardId
                    Customer.getEmailByCardId(cardId, async (error, result) => {
                        if (error || !result.length) {
                            console.error('Fetching email failed:', error);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Fetching email failed', error }));
                        } else {
                            const userEmail = result[0].email;
    
                            // Update the card status to 2 (deleted)
                            Customer.updateCardStatus(cardId, 2, async (updateError, updateResult) => {
                                if (updateError) {
                                    console.error('Card deletion failed:', updateError);
                                    res.writeHead(500, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ message: 'Card deletion failed', error: updateError }));
                                } else {
                                    // Send an email to the user to notify them of the deletion
                                    try {
                                        await sendEmail(
                                            userEmail,
                                            'Card Deletion Confirmation',
                                            'Your card has been deleted successfully.',
                                            '<p>Your card has been deleted successfully.</p>'
                                        );
    
                                        res.writeHead(200, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ success: true, message: 'Card deleted and email sent successfully', data: { cardId } }));
                                    } catch (emailError) {
                                        console.error('Email sending failed:', emailError);
                                        res.writeHead(200, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ success: true, message: 'Card deleted but email sending failed', data: { cardId }, error: emailError }));
                                    }
                                }
                            });
                        }
                    });
                }
            } catch (error) {
                console.error('Card deletion failed:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Card deletion failed', error }));
            }
        });
    },

    //Re-activate card

    reactivateCard: function (req, res) {
        let body = '';
    
        req.on('data', chunk => {
            body += chunk.toString(); // Convert Buffer to string
        });
    
        req.on('end', async () => {
            try {
                const requestData = JSON.parse(body);
                const cardId = requestData['cardId'];
    
                if (!cardId) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing cardId in the request body' }));
                } else {



                    Customer.getCardStatus(cardId, async (statusError, currentStatus) => {
                        if (statusError) {
                            console.error('Fetching card status failed:', statusError);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Fetching card status failed', error: statusError }));
                            return;
                        }

                        if (currentStatus !== 0) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Card is either active or deleted'}));
                            return;
                        }
                    })

                    // Fetch the email address associated with the cardId
                    Customer.getEmailByCardId(cardId, async (error, result) => {
                        if (error || !result.length) {
                            console.error('Fetching email failed:', error);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Fetching email failed', error }));
                        } else {
                            const userEmail = result[0].email;
    
                            // Update the card status to 1 (reactivated)
                            Customer.updateCardStatus(cardId, 1, async (updateError, updateResult) => {
                                if (updateError) {
                                    console.error('Card reactivation failed:', updateError);
                                    res.writeHead(500, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ message: 'Card reactivation failed', error: updateError }));
                                } else {
                                    // Send an email to the user to notify them of the reactivation
                                    try {
                                        await sendEmail(
                                            userEmail,
                                            'Card Reactivation Confirmation',
                                            'Your card has been reactivated successfully.',
                                            '<p>Your card has been reactivated successfully.</p>'
                                        );
    
                                        res.writeHead(200, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ success: true, message: 'Card reactivated and email sent successfully', data: { cardId } }));
                                    } catch (emailError) {
                                        console.error('Email sending failed:', emailError);
                                        res.writeHead(200, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ success: true, message: 'Card reactivated but email sending failed', data: { cardId }, error: emailError }));
                                    }
                                }
                            });
                        }
                    });
                }
            } catch (error) {
                console.error('Card reactivation failed:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Card reactivation failed', error }));
            }
        });
    }
    
    

};

module.exports = reportCardController;
