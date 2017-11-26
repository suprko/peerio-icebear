Feature: User account

    User has to be able to
    - create a new account
    - use his credentials to log in
    - delete the account, provided confirmed email exists.
    - modify account settings

    TODO: make sure email confirmation warning arrives
    TODO: all kinds of validations
    TODO: attempt to register existing username with different key and check if it doesn't mess it up

    Background:
        Given I create an account

    Scenario: user creates an account
        Then  I am authenticated
        And   I should have default account settings
        And   I should not have paid plans
        When  I restart
        And   I login
        Then  I am authenticated
        And   I should have default account settings
        And   I should not have paid plans

    Scenario: user deletes existing account
        Given I confirm my primary email
        Then  my primary email is confirmed
        When  I delete my account
        Then  I am not authenticated
        When  I restart
        Then  I am not able to login

    Scenario: user modifies account settings
        When  I change my account settings
        Then  my account settings are changed
        When  I restart
        And   I login
        Then  I am authenticated
        Then  my account settings are changed